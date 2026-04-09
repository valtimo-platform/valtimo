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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.notificatiesapi.service

import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.exception.AuthorizationException
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.task.TaskExecutor
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class NotificatiesApiServiceTest {

    private val abonnementLinkRepository: NotificatiesApiAbonnementLinkRepository = mock()
    private val intakeService: NotificatiesApiInboundEventIntakeService = mock()
    private val processingService: NotificatiesApiInboundEventProcessingService = mock()

    @AfterEach
    fun tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.setActualTransactionActive(false)
            TransactionSynchronizationManager.clearSynchronization()
        }
    }

    @Test
    fun `registerNotification processes immediately when no transaction`() {
        val eventId = UUID.randomUUID()
        val notification = sampleNotification()
        whenever(intakeService.registerInboundNotification(notification)).thenReturn(eventId)

        val service = createService()

        val result = service.registerNotification(notification)

        assertTrue(result)
        verify(processingService).processEvent(eventId)
    }

    @Test
    fun `registerNotification defers processing until after commit when transaction active`() {
        TransactionSynchronizationManager.initSynchronization()
        TransactionSynchronizationManager.setActualTransactionActive(true)

        val eventId = UUID.randomUUID()
        val notification = sampleNotification()
        whenever(intakeService.registerInboundNotification(notification)).thenReturn(eventId)

        val service = createService()

        val result = service.registerNotification(notification)

        assertTrue(result)
        verify(processingService, never()).processEvent(eventId)

        val synchronizations = TransactionSynchronizationManager.getSynchronizations().toList()
        synchronizations.forEach { it.afterCommit() }

        verify(processingService).processEvent(eventId)
        TransactionSynchronizationManager.setActualTransactionActive(false)
        TransactionSynchronizationManager.clearSynchronization()
    }

    @Test
    fun `registerNotification returns false for duplicate`() {
        val notification = sampleNotification()
        whenever(intakeService.registerInboundNotification(notification)).thenReturn(null)

        val service = createService()

        val result = service.registerNotification(notification)

        assertFalse(result)
        verify(processingService, never()).processEvent(any())
    }

    @Test
    fun `findAbonnementSubscription delegates to repository`() {
        val configuration = NotificatiesApiAbonnementLink(NotificatiesApiConfigurationId(UUID.randomUUID()), "url", "auth")
        whenever(abonnementLinkRepository.findByAuth("token")) doReturn configuration

        val service = createService()
        val result = service.findAbonnementSubscription("token")

        assertNotNull(result)
    }

    @Test
    fun `findAbonnementSubscription throws when not found`() {
        whenever(abonnementLinkRepository.findByAuth("token")) doReturn null

        val service = createService()

        org.assertj.core.api.Assertions.assertThatThrownBy {
            service.findAbonnementSubscription("token")
        }.isInstanceOf(AuthorizationException::class.java)
    }

    private fun createService(taskExecutor: TaskExecutor = TaskExecutor { it.run() }): NotificatiesApiService {
        return NotificatiesApiService(
            abonnementLinkRepository,
            intakeService,
            processingService,
            taskExecutor
        )
    }

    private fun sampleNotification(): NotificatiesApiNotificationReceivedEvent {
        return NotificatiesApiNotificationReceivedEvent(
            kanaal = "kanaal",
            hoofdObject = "http://example.com/object/1",
            resourceUrl = "http://example.com",
            actie = "create",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("bronId" to UUID.randomUUID().toString()),
            resource = null
        )
    }
}
