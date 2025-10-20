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
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import jakarta.persistence.EntityNotFoundException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

class NotificatiesApiInboundEventAdminService(
    private val inboundEventRepository: NotificatiesApiInboundEventRepository,
    private val processingProperties: NotificatiesApiProcessingProperties
) {

    fun getFailedEventCount(): Long {
        return inboundEventRepository.countByStatus(NotificatiesApiInboundEventStatus.FAILED)
    }

    @Transactional
    fun retryFailedEvent(id: UUID) {
        val event = inboundEventRepository.findById(id).orElseThrow {
            EntityNotFoundException("Inbound notificaties event $id not found")
        }
        event.status = NotificatiesApiInboundEventStatus.RECEIVED
        event.pendingRetries = processingProperties.initialRetries
    }
}
