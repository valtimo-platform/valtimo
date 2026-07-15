/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.outbox

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfSystemProperty
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime

class OutboxMessageRepositoryIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var platformTransactionManager: PlatformTransactionManager

    @Test
    @EnabledIfSystemProperty(named = "spring.profiles.include", matches = ".*postgres.*")
    fun `should skip reading locked messages from the outbox table on postgres`(): Unit = runBlocking {
        val (message1, message2) = readOldestMessageFromTwoConcurrentReaders()

        // On PostgreSQL each concurrent reader locks a different row, so both get a distinct message.
        assertThat(message1!!.message).isNotEqualTo(message2!!.message)
    }

    @Test
    @EnabledIfSystemProperty(named = "spring.profiles.include", matches = ".*mysql.*")
    fun `should never read the same message from two concurrent readers on mysql`(): Unit = runBlocking {
        val (message1, message2) = readOldestMessageFromTwoConcurrentReaders()

        // On MySQL, gap-locking during the ordered FOR UPDATE SKIP LOCKED scan can starve one reader
        // (it reads nothing). The guarantee that still holds is the important one for correctness: the
        // same message is never read by both readers, so no message is ever processed twice.
        val readMessages = listOfNotNull(message1, message2).map { it.message }
        assertThat(readMessages).doesNotHaveDuplicates()
    }

    @Test
    fun `should fetch batch of messages ordered by created_on`() {
        // created_on is a whole-second DATETIME on MySQL, so space the inserts a full second apart to
        // get distinct timestamps - and therefore deterministic ordering - on every database.
        val baseTime = LocalDateTime.now().withNano(0)
        insertOutboxMessage("event 1", baseTime)
        insertOutboxMessage("event 2", baseTime.plusSeconds(1))
        insertOutboxMessage("event 3", baseTime.plusSeconds(2))

        val messages = TransactionTemplate(platformTransactionManager).execute {
            outboxMessageRepository.findOutboxMessages(10)
        }!!

        assertThat(messages).hasSize(3)
        assertThat(messages[0].message).contains("event 1")
        assertThat(messages[1].message).contains("event 2")
        assertThat(messages[2].message).contains("event 3")
    }

    @Test
    fun `should limit batch size`() {
        insertOutboxMessage("event 1")
        insertOutboxMessage("event 2")
        insertOutboxMessage("event 3")

        val messages = TransactionTemplate(platformTransactionManager).execute {
            outboxMessageRepository.findOutboxMessages(2)
        }!!

        assertThat(messages).hasSize(2)
    }

    @Test
    fun `should return empty list when no messages exist`() {
        val messages = TransactionTemplate(platformTransactionManager).execute {
            outboxMessageRepository.findOutboxMessages(10)
        }!!

        assertThat(messages).isEmpty()
    }

    @Test
    @EnabledIfSystemProperty(named = "spring.profiles.include", matches = ".*postgres.*")
    fun `should skip locked messages in batch fetch on postgres`(): Unit = runBlocking {
        val (batch1, batch2) = fetchSecondBatchWhileFirstBatchIsLocked()

        // On PostgreSQL, FOR UPDATE SKIP LOCKED skips exactly the locked rows and returns the rest,
        // so the second poller reliably picks up the one remaining message.
        assertThat(batch1).hasSize(2)
        assertThat(batch2).hasSize(1)
        assertThat(batch1.map { it.id }).doesNotContainAnyElementsOf(batch2.map { it.id })
    }

    @Test
    @EnabledIfSystemProperty(named = "spring.profiles.include", matches = ".*mysql.*")
    fun `should never deliver a locked message to a second poller on mysql`(): Unit = runBlocking {
        val (batch1, batch2) = fetchSecondBatchWhileFirstBatchIsLocked()

        // On MySQL, ORDER BY created_on ASC + FOR UPDATE SKIP LOCKED gap-locks the ordered index
        // scan (see MySqlOutboxMessageRepository), so the second poller may skip the remaining
        // message instead of returning it. The guarantee that still holds is the important one for
        // correctness: a message locked by one poller is never handed to another, so no message is
        // ever processed twice.
        assertThat(batch1).hasSize(2)
        // No message locked by the first poller may reappear in the second poller's batch. We assert
        // the intersection directly because batch2 can be empty on MySQL, and AssertJ's
        // doesNotContainAnyElementsOf rejects an empty argument.
        assertThat(batch1.map { it.id }.intersect(batch2.map { it.id }.toSet())).isEmpty()
        // FIFO / no-starvation is NOT guaranteed on MySQL under concurrent pollers: batch2 may be
        // empty because the third message gets skipped by the gap-locked scan.
        assertThat(batch2.size).isLessThanOrEqualTo(1)
    }

    private suspend fun fetchSecondBatchWhileFirstBatchIsLocked() = coroutineScope {
        insertOutboxMessage("event 1")
        Thread.sleep(10)
        insertOutboxMessage("event 2")
        Thread.sleep(10)
        insertOutboxMessage("event 3")

        // First transaction locks the first 2 messages and holds the lock
        val locksAcquired = CompletableDeferred<Unit>()
        val batch1Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val messages = outboxMessageRepository.findOutboxMessages(2)
                locksAcquired.complete(Unit)
                Thread.sleep(1000) // hold the lock
                messages
            }
        }

        // Second transaction fetches while the first 2 messages are still locked
        withTimeout(2_000) { locksAcquired.await() }
        val batch2Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                outboxMessageRepository.findOutboxMessages(2)
            }
        }

        batch1Ref.await()!! to batch2Ref.await()!!
    }

    @Suppress("DEPRECATION")
    private suspend fun readOldestMessageFromTwoConcurrentReaders() = coroutineScope {
        insertOutboxMessage("event 1")
        insertOutboxMessage("event 2")

        val message1Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val outboxMessage = outboxMessageRepository.findOutboxMessage()
                Thread.sleep(1000) // hold the lock so the other reader sees it locked
                outboxMessage
            }
        }

        val message2Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val outboxMessage = outboxMessageRepository.findOutboxMessage()
                Thread.sleep(1000) // hold the lock so the other reader sees it locked
                outboxMessage
            }
        }

        message1Ref.await() to message2Ref.await()
    }
}
