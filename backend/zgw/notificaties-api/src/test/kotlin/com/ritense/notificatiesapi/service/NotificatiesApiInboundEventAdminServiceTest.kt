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

import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import jakarta.persistence.EntityNotFoundException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class NotificatiesApiInboundEventAdminServiceTest {

    private val repository: NotificatiesApiInboundEventRepository = mock()
    private val properties = NotificatiesApiProcessingProperties().apply { initialRetries = 4 }
    private val service = NotificatiesApiInboundEventAdminService(repository, properties)

    @Test
    fun `resetting retry updates event`() {
        val event = NotificatiesApiInboundEvent(
            idempotenceKey = "key",
            payload = "payload",
            status = NotificatiesApiInboundEventStatus.FAILED,
            pendingRetries = 0,
            lastProcessedAt = LocalDateTime.now(),
            lastErrorMessage = "failure",
            receivedAt = LocalDateTime.MIN
        )
        val id = UUID.randomUUID()
        whenever(repository.findById(id)).thenReturn(Optional.of(event))

        service.retryFailedEvent(id)

        assertEquals(NotificatiesApiInboundEventStatus.RECEIVED, event.status)
        assertEquals(properties.initialRetries, event.pendingRetries)
        assertEquals(event.receivedAt, event.nextDueAt)
    }

    @Test
    fun `retry missing event throws`() {
        val id = UUID.randomUUID()
        whenever(repository.findById(id)).thenReturn(Optional.empty())

        assertThrows<EntityNotFoundException> {
            service.retryFailedEvent(id)
        }
    }
}
