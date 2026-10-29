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

import com.ritense.notificatiesapi.NotificatiesApiKanaalFilters
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.ABONNEMENT_REGISTRATION_PROPERTY
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.AUTH_HEADER_PROPERTY
import com.ritense.notificatiesapi.domain.AbonnementRegistration
import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.exception.AuthorizationException
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.notificatiesapi.web.dto.NotificatiesApiManualAbonnementResponse
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.RejectedExecutionException

@Service
@SkipComponentScan
class NotificatiesApiService @JvmOverloads constructor(
    private val notificatiesApiAbonnementLinkRepository: NotificatiesApiAbonnementLinkRepository,
    private val inboundEventIntakeService: NotificatiesApiInboundEventIntakeService,
    private val inboundEventProcessingService: NotificatiesApiInboundEventProcessingService,
    private val taskExecutor: TaskExecutor,
    private val pluginService: PluginService? = null
) {

    fun registerNotification(notification: NotificatiesApiNotificationReceivedEvent): Boolean {
        logger.debug { "Notification received: $notification" }
        val eventId = inboundEventIntakeService.registerInboundNotification(notification)
        if (eventId != null) {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                    override fun afterCommit() {
                        submitForProcessing(eventId)
                    }
                })
            } else {
                submitForProcessing(eventId)
            }
        }
        return eventId != null
    }

    private fun submitForProcessing(eventId: UUID) {
        try {
            taskExecutor.execute {
                inboundEventProcessingService.processEvent(eventId)
            }
        } catch (ex: RejectedExecutionException) {
            logger.warn(ex) { "Processing queue full, deferring inbound event $eventId to scheduled worker" }
        }
    }

    fun findAbonnementSubscription(authHeader: String): NotificatiesApiAbonnementLink {
        return notificatiesApiAbonnementLinkRepository.findByAuth(authHeader)
            ?: throw AuthorizationException()
    }

    fun isAuthorizedCallback(authHeader: String): Boolean {
        if (authHeader.isBlank()) return false
        val manualSecrets = findManualAbonnementSecrets()
        if (manualSecrets.values.any { secret -> !secret.isNullOrBlank() && secretsMatch(secret, authHeader) }) {
            return true
        }
        val abonnementLink = notificatiesApiAbonnementLinkRepository.findByAuth(authHeader) ?: return false
        return abonnementLink.notificatiesApiConfigurationId.id !in manualSecrets.keys
    }

    private fun findManualAbonnementSecrets(): Map<UUID, String?> {
        val service = pluginService ?: return emptyMap()
        return service.findPluginConfigurations(NotificatiesApiPlugin::class.java) { properties ->
            properties.path(ABONNEMENT_REGISTRATION_PROPERTY).textValue() == AbonnementRegistration.MANUAL.value
        }.associate { it.id.id to it.properties?.path(AUTH_HEADER_PROPERTY)?.textValue() }
    }

    fun getManualAbonnement(configurationId: UUID): NotificatiesApiManualAbonnementResponse? {
        val service = pluginService ?: return null
        val configuration = service.findPluginConfiguration(PluginConfigurationId.existingId(configurationId))
            ?: return null
        val plugin = service.createInstance(configuration) as? NotificatiesApiPlugin ?: return null
        if (!plugin.isManualAbonnementRegistration()) return null

        return NotificatiesApiManualAbonnementResponse(
            callbackUrl = plugin.callbackUrlOrNull()?.toASCIIString(),
            kanalen = NotificatiesApiKanaalFilters.fromPluginService(service).manualKanaalFilters(configurationId)
        )
    }

    private fun secretsMatch(expected: String, actual: String) =
        MessageDigest.isEqual(expected.toByteArray(Charsets.UTF_8), actual.toByteArray(Charsets.UTF_8))

    companion object {
        val logger = KotlinLogging.logger {}
    }
}