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
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.LocalDateTime
import java.util.HexFormat
import java.util.UUID

@Service
@SkipComponentScan
class NotificatiesApiInboundEventIntakeService(
    private val objectMapper: ObjectMapper,
    private val inboundEventRepository: NotificatiesApiInboundEventRepository,
    private val processingProperties: NotificatiesApiProcessingProperties
) {

    @Transactional
    fun registerInboundNotification(notification: NotificatiesApiNotificationReceivedEvent): UUID? {
        val idempotenceKey = generateIdempotenceKey(notification)
        inboundEventRepository.findByIdempotenceKey(idempotenceKey)?.let {
            logger.debug { "Skipping duplicate inbound notification for key $idempotenceKey" }
            return null
        }

        val payload = objectMapper.writeValueAsString(notification)
        val event = NotificatiesApiInboundEvent(
            idempotenceKey = idempotenceKey,
            payload = payload,
            status = NotificatiesApiInboundEventStatus.RECEIVED,
            pendingRetries = processingProperties.initialRetries,
            receivedAt = LocalDateTime.now()
        )

        return try {
            val saved = inboundEventRepository.save(event)
            logger.debug { "Stored inbound notification with key $idempotenceKey" }
            saved.id
        } catch (ex: DataIntegrityViolationException) {
            logger.debug { "Detected concurrent duplicate inbound notification for key $idempotenceKey" }
            null
        }
    }

    fun generateIdempotenceKey(notification: NotificatiesApiNotificationReceivedEvent): String {
        val kenmerkenPart = notification.kenmerken
            .toSortedMap()
            .entries
            .joinToString(separator = "|") { (key, value) -> "$key=$value" }

        val canonicalValue = listOf(
            notification.kanaal,
            notification.resourceUrl,
            notification.actie,
            notification.hoofdObject,
            notification.aanmaakdatum,
            kenmerkenPart
        ).joinToString(separator = "|")

        val digest = MESSAGE_DIGEST.get().digest(canonicalValue.toByteArray(StandardCharsets.UTF_8))
        return HexFormat.of().formatHex(digest)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val MESSAGE_DIGEST = ThreadLocal.withInitial { MessageDigest.getInstance("SHA-256") }
    }
}
