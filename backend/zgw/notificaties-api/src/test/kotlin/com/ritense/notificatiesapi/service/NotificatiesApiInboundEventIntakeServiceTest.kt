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

package com.ritense.notificatiesapi.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import java.time.LocalDateTime
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NotificatiesApiInboundEventIntakeServiceTest {

    private lateinit var intakeService: NotificatiesApiInboundEventIntakeService
    private lateinit var repository: NotificatiesApiInboundEventRepository
    private lateinit var properties: NotificatiesApiProcessingProperties

    @BeforeEach
    fun setup() {
        repository = mock()
        properties = NotificatiesApiProcessingProperties().apply {
            initialRetries = 3
        }
        val mapper = ObjectMapper()
            .registerKotlinModule()
            .registerModule(JavaTimeModule())
        intakeService = NotificatiesApiInboundEventIntakeService(mapper, repository, properties)
    }

    @Test
    fun `stores new inbound notification`() {
        val notification = sampleNotification()
        doReturn(null).whenever(repository).findByIdempotenceKey(any())
        whenever(repository.save(any())).thenAnswer { invocation -> invocation.arguments[0] }

        val saved = argumentCaptor<NotificatiesApiInboundEvent>()

        val result = intakeService.registerInboundNotification(notification)

        assertNotNull(result)
        verify(repository).save(saved.capture())
        assertEquals(NotificatiesApiInboundEventStatus.RECEIVED, saved.firstValue.status)
        assertEquals(properties.initialRetries, saved.firstValue.pendingRetries)
    }

    @Test
    fun `skips duplicate inbound notification`() {
        val notification = sampleNotification()
        doReturn(
            NotificatiesApiInboundEvent(
                idempotenceKey = "key",
                payload = "{}",
                status = NotificatiesApiInboundEventStatus.RECEIVED
            )
        ).whenever(repository).findByIdempotenceKey(any())

        val result = intakeService.registerInboundNotification(notification)

        assertNull(result)
        verify(repository, never()).save(any())
    }

    @Test
    fun `handles concurrent duplicate via constraint`() {
        val notification = sampleNotification()
        doReturn(null).whenever(repository).findByIdempotenceKey(any())
        doThrow(DataIntegrityViolationException("duplicate")).whenever(repository).save(any())

        val result = intakeService.registerInboundNotification(notification)

        assertNull(result)
    }

    @Test
    fun `generates deterministic idempotence key`() {
        val notification = sampleNotification()
        val shuffled = notification.copy(kenmerken = mapOf("b" to "2", "a" to "1"))

        val baseKey = intakeService.generateIdempotenceKey(notification)
        val permutedKey = intakeService.generateIdempotenceKey(shuffled)

        assertEquals(baseKey, permutedKey)
    }

    private fun sampleNotification(): NotificatiesApiNotificationReceivedEvent {
        return NotificatiesApiNotificationReceivedEvent(
            kanaal = "kanaal",
            resourceUrl = "http://example.com",
            hoofdObject = "http://example.com/object/1",
            actie = "update",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("a" to "1", "b" to "2")
        )
    }
}
