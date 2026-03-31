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

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.DisabledIfSystemProperty
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

class OutboxMessageRepositoryIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var platformTransactionManager: PlatformTransactionManager

    // MySQL/InnoDB gap-locks on the created_on index prevent SKIP LOCKED from working across
    // concurrent transactions. Not a problem in practice since only a single poller is used.
    @DisabledIfSystemProperty(named = "spring.profiles.include", matches = ".*mysql.*")
    @Test
    fun `should skip reading locked messages from the outbox table`(): Unit = runBlocking {
        insertOutboxMessage("event 1")
        insertOutboxMessage("event 2")

        val outboxMessage1Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val outboxMessage = outboxMessageRepository.findOutboxMessage()
                Thread.sleep(1000)
                outboxMessage
            }
        }

        val outboxMessage2Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val outboxMessage = outboxMessageRepository.findOutboxMessage()
                Thread.sleep(1000)
                outboxMessage
            }
        }

        assertThat(outboxMessage1Ref.await()!!.message).isNotEqualTo(outboxMessage2Ref.await()!!.message)
    }

    @Test
    fun `should fetch batch of messages ordered by created_on`() {
        insertOutboxMessage("event 1")
        Thread.sleep(10)
        insertOutboxMessage("event 2")
        Thread.sleep(10)
        insertOutboxMessage("event 3")

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

    @DisabledIfSystemProperty(named = "spring.profiles.include", matches = ".*mysql.*")
    @Test
    fun `should skip locked messages in batch fetch`(): Unit = runBlocking {
        insertOutboxMessage("event 1")
        Thread.sleep(10)
        insertOutboxMessage("event 2")
        Thread.sleep(10)
        insertOutboxMessage("event 3")

        // First transaction locks the first 2 messages
        val batch1Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                val messages = outboxMessageRepository.findOutboxMessages(2)
                Thread.sleep(1000) // hold the lock
                messages
            }
        }

        // Second transaction should skip the locked messages and get the 3rd
        Thread.sleep(100) // ensure first transaction has acquired locks
        val batch2Ref = async(Dispatchers.IO) {
            TransactionTemplate(platformTransactionManager).execute {
                outboxMessageRepository.findOutboxMessages(2)
            }
        }

        val batch1 = batch1Ref.await()!!
        val batch2 = batch2Ref.await()!!

        assertThat(batch1).hasSize(2)
        assertThat(batch2).hasSize(1)
        assertThat(batch1.map { it.id }).doesNotContainAnyElementsOf(batch2.map { it.id })
    }
}
