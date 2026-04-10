/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventProcessingService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventQueryService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals

class NotificatiesApiInboundEventRepositoryIT : BaseIntegrationTest() {

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    private lateinit var processingService: NotificatiesApiInboundEventProcessingService
    private lateinit var queryService: NotificatiesApiInboundEventQueryService
    private lateinit var processingProperties: NotificatiesApiProcessingProperties
    private lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun setUp() {
        objectMapper = ObjectMapper()
            .registerKotlinModule()
            .registerModule(JavaTimeModule())
        processingProperties = NotificatiesApiProcessingProperties().apply {
            batchSize = 5
            initialRetries = 2
            retryDelay = Duration.ofSeconds(1)
            retryBackoffMultiplier = 1.0
            retentionPeriod = Duration.ofHours(1)
            receivedWarningThreshold = Duration.ofMinutes(30)
        }
        transactionTemplate.executeWithoutResult {
            inboundEventRepository.deleteAll()
        }
        processingService = NotificatiesApiInboundEventProcessingService(
            inboundEventRepository,
            applicationEventPublisher,
            objectMapper,
            processingProperties,
            requireNotNull(transactionTemplate.transactionManager)
        )
        queryService = NotificatiesApiInboundEventQueryService(inboundEventRepository)
    }

    @Test
    fun `should persist and fetch inbound events`() {
        val idempotenceKey = UUID.randomUUID().toString()
        val event = NotificatiesApiInboundEvent(
            idempotenceKey = idempotenceKey,
            payload = samplePayload(),
            status = NotificatiesApiInboundEventStatus.RECEIVED,
            pendingRetries = processingProperties.initialRetries,
            receivedAt = LocalDateTime.now()
        )

        transactionTemplate.executeWithoutResult {
            inboundEventRepository.save(event)
        }

        val fetched = inboundEventRepository.findByIdempotenceKey(idempotenceKey)
        requireNotNull(fetched)
        assertEquals(NotificatiesApiInboundEventStatus.RECEIVED, fetched.status)
        assertEquals(event.payload, fetched.payload)
    }

    @Test
    fun `worker should transition events from received to processed`() {
        val eventId = transactionTemplate.execute {
            val event = NotificatiesApiInboundEvent(
                idempotenceKey = UUID.randomUUID().toString(),
                payload = samplePayload(),
                status = NotificatiesApiInboundEventStatus.RECEIVED,
                pendingRetries = processingProperties.initialRetries,
                receivedAt = LocalDateTime.now().minusMinutes(10)
            )
            inboundEventRepository.save(event)
            event.id
        }!!

        processingService.processBatch()

        val processed = inboundEventRepository.findById(eventId).get()
        assertEquals(NotificatiesApiInboundEventStatus.PROCESSED, processed.status)
        requireNotNull(processed.lastProcessedAt)
        assertEquals(0, processed.pendingRetries)
    }

    @Test
    fun `query service should paginate failed events`() {
        transactionTemplate.executeWithoutResult {
            repeat(3) {
                inboundEventRepository.save(
                    NotificatiesApiInboundEvent(
                        idempotenceKey = UUID.randomUUID().toString(),
                        payload = samplePayload(),
                        status = NotificatiesApiInboundEventStatus.FAILED,
                        pendingRetries = 1,
                        receivedAt = LocalDateTime.now().minusMinutes(it.toLong())
                    )
                )
            }
        }

        val page = queryService.findFailedEvents(pageableOfSize(2))

        assertEquals(3, page.totalElements)
        assertEquals(2, page.content.size)
        assertEquals(NotificatiesApiInboundEventStatus.FAILED, page.content.first().status)
    }

    private fun samplePayload(): String {
        val notification = NotificatiesApiNotificationReceivedEvent(
            kanaal = "klantcontact",
            hoofdObject = null,
            resourceUrl = "http://example.com/resource/${UUID.randomUUID()}",
            actie = "create",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("bronId" to UUID.randomUUID().toString()),
            resource = null
        )
        return objectMapper.writeValueAsString(notification)
    }

    private fun pageableOfSize(size: Int) = org.springframework.data.domain.PageRequest.of(0, size)
}
