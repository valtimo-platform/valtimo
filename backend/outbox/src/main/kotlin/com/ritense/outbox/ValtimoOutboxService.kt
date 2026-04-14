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

import com.ritense.outbox.domain.BaseEvent
import com.ritense.outbox.repository.OutboxMessageRepository
import io.cloudevents.core.provider.EventFormatProvider
import io.cloudevents.jackson.JsonFormat
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import java.util.function.Supplier
import kotlin.text.Charsets.UTF_8

open class ValtimoOutboxService(
    private val outboxMessageRepository: OutboxMessageRepository,
    private val cloudEventFactory: CloudEventFactory,
    transactionManager: PlatformTransactionManager,
) : OutboxService {

    private val requiresNewTransactionTemplate = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    }

    @Transactional(propagation = Propagation.MANDATORY)
    override fun send(eventSupplier: Supplier<BaseEvent>) {
        if (OutboxContext.outboxSuppressed) {
            logger.debug { "Outbox is suppressed, skipping message" }
            return
        }

        val cloudEvent = cloudEventFactory.create(eventSupplier.get())
        val serializedCloudEvent = EventFormatProvider
            .getInstance()
            .resolveFormat(JsonFormat.CONTENT_TYPE)!!
            .serialize(cloudEvent)
        val serializedCloudEventString = String(serializedCloudEvent, UTF_8)

        send(serializedCloudEventString)
    }

    /**
     * Guarantee that the message is published using the transactional outbox pattern.
     * See: https://microservices.io/patterns/data/transactional-outbox.html
     *
     * Typical workflow:
     * @Transactional
     * fun saveOrders() {
     *      orderRepo.save(order)
     *      order.events.forEach { outboxService.send(it) }
     *      order.events.clear()
     * }
     */
    @Transactional(propagation = Propagation.MANDATORY)
    open fun send(message: String) {
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            deferMessage(message)
            return
        }

        persistMessage(message)
    }

    /**
     * Collects deferred messages for a read-only transaction and persists them all in a single
     * REQUIRES_NEW transaction during beforeCommit. This avoids opening a separate transaction
     * per message, which would otherwise cause N transactions for N messages.
     *
     * Messages are stored as a transaction-bound resource using [TransactionSynchronizationManager],
     * and a single [TransactionSynchronization] is registered on the first call. Subsequent calls
     * within the same transaction simply add to the existing list.
     */
    private fun deferMessage(message: String) {
        val key = DeferredMessagesKey::class.java

        @Suppress("UNCHECKED_CAST")
        var deferredMessages = TransactionSynchronizationManager.getResource(key) as MutableList<String>?

        if (deferredMessages == null) {
            deferredMessages = mutableListOf()
            TransactionSynchronizationManager.bindResource(key, deferredMessages)
            TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                override fun beforeCommit(readOnly: Boolean) {
                    @Suppress("UNCHECKED_CAST")
                    val messages = TransactionSynchronizationManager.getResource(key) as List<String>
                    requiresNewTransactionTemplate.executeWithoutResult {
                        persistMessages(messages)
                    }
                }

                override fun afterCompletion(status: Int) {
                    TransactionSynchronizationManager.unbindResourceIfPossible(key)
                }
            })
        }

        deferredMessages.add(message)
    }

    private fun persistMessage(message: String) {
        val outboxMessage = OutboxMessage(message = message)
        logger.debug { "Saving OutboxMessage '${outboxMessage.id}'" }
        outboxMessageRepository.save(outboxMessage)
    }

    private fun persistMessages(messages: List<String>) {
        val outboxMessages = messages.map { OutboxMessage(message = it) }
        logger.debug { "Saving ${outboxMessages.size} OutboxMessage(s)" }
        outboxMessageRepository.saveAll(outboxMessages)
    }

    /** Resource key used to bind the list of deferred messages to the current transaction. */
    private object DeferredMessagesKey

    @Deprecated(
        message = "Will be removed in 14.0. Use getOldestMessages(batchSize) instead",
        replaceWith = ReplaceWith("getOldestMessages(1).firstOrNull()")
    )
    @Transactional(propagation = Propagation.MANDATORY)
    open fun getOldestMessage() = outboxMessageRepository.findOutboxMessage()

    @Transactional(propagation = Propagation.MANDATORY)
    open fun getOldestMessages(batchSize: Int): List<OutboxMessage> =
        outboxMessageRepository.findOutboxMessages(batchSize)

    @Deprecated(
        message = "Will be removed in 14.0. Use deleteMessages(ids) instead",
        replaceWith = ReplaceWith("deleteMessages(listOf(id))")
    )
    @Transactional(propagation = Propagation.MANDATORY)
    open fun deleteMessage(id: UUID) = outboxMessageRepository.deleteById(id)

    @Transactional(propagation = Propagation.MANDATORY)
    open fun deleteMessages(ids: List<UUID>) = outboxMessageRepository.deleteAllById(ids)

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
