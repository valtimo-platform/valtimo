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

package com.ritense.notificatiesapi

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.logging.withLoggingContext
import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.Kanaal
import com.ritense.notificatiesapi.domain.Notificatie
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.listener.ReceiveNotificatieProperties
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginAction
import com.ritense.plugin.annotation.PluginActionProperty
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName.INTERMEDIATE_CATCH_EVENT_END
import com.ritense.processlink.domain.ActivityTypeWithEventName.INTERMEDIATE_THROW_EVENT_START
import com.ritense.processlink.domain.ActivityTypeWithEventName.MESSAGE_START_EVENT_START
import com.ritense.processlink.domain.ActivityTypeWithEventName.RECEIVE_TASK_END
import com.ritense.processlink.domain.ActivityTypeWithEventName.SEND_TASK_START
import com.ritense.valtimo.contract.validation.Url
import io.github.oshai.kotlinlogging.KotlinLogging
import java.net.URI
import java.time.LocalDateTime

@Plugin(
    key = "notificatiesapi",
    title = "Notificaties API",
    description = "Enable interfacing with Notificaties API specification compliant APIs"
)
class NotificatiesApiPlugin(
    pluginConfigurationId: PluginConfigurationId,
    private val client: NotificatiesApiClient,
    private val objectMapper: ObjectMapper,
    private val pluginProcessLinkRepository: PluginProcessLinkRepository,
) : NotificatiesApiListener {
    val notificatiesApiConfigurationId = NotificatiesApiConfigurationId(pluginConfigurationId.id)

    @Url
    @PluginProperty(key = "url", secret = false)
    lateinit var url: URI

    @Url
    @PluginProperty(key = "callbackUrl", secret = false)
    lateinit var callbackUrl: URI

    @PluginProperty(key = "authHeader", secret = false, required = false)
    var authHeader: String? = null

    @PluginProperty(key = "authenticationPluginConfiguration", secret = false)
    lateinit var authenticationPluginConfiguration: NotificatiesApiAuthentication

    @PluginAction(
        key = "publish-notificatie",
        title = "Publiceer een notificatie",
        description = "Publiceert een notificatie via de Notificaties API",
        activityTypes = [SEND_TASK_START, INTERMEDIATE_THROW_EVENT_START]
    )
    fun publishNotificatie(
        @PluginActionProperty kanaal: String,
        @PluginActionProperty hoofdObject: URI,
        @PluginActionProperty resource: String,
        @PluginActionProperty resourceUrl: URI,
        @PluginActionProperty actie: String,
        @PluginActionProperty aanmaakdatum: LocalDateTime?,
        @PluginActionProperty kenmerken: Map<String, String>?,
    ) = withLoggingContext(
        PluginConfiguration::class.java.canonicalName to notificatiesApiConfigurationId.toString()
    ) {
        logger.debug { "Publishing notificatie on kanaal '$kanaal'" }
        val notificatie = Notificatie(
            kanaal = kanaal,
            hoofdObject = hoofdObject,
            resource = resource,
            resourceUrl = resourceUrl,
            actie = actie,
            aanmaakdatum = aanmaakdatum ?: LocalDateTime.now(),
            kenmerken = kenmerken,
        )
        client.createNotificatie(authenticationPluginConfiguration, url, notificatie)
        logger.info { "Successfully published notificatie on kanaal '$kanaal'" }
    }

    @PluginAction(
        key = RECEIVE_NOTIFICATIE_ACTION_KEY,
        title = "Ontvang een notificatie",
        description = "Wacht op een binnenkomende notificatie via de Notificaties API",
        activityTypes = [RECEIVE_TASK_END, INTERMEDIATE_CATCH_EVENT_END, MESSAGE_START_EVENT_START]
    )
    fun receiveNotificatie(
        @PluginActionProperty kanaal: String?,
        @PluginActionProperty actie: String?,
        @PluginActionProperty kenmerken: Map<String, String>?,
    ) {
        logger.debug { "Receive notificatie action invoked for kanaal='$kanaal', actie='$actie', kenmerken=$kenmerken" }
    }

    override fun getNotificatiesApiPlugin(): NotificatiesApiPlugin = this

    override fun getKanaalFilters(): List<Abonnement.Kanaal> {
        return pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(
            NOTIFICATIES_API_PLUGIN_DEFINITION_KEY,
            RECEIVE_NOTIFICATIE_ACTION_KEY
        ).mapNotNull { pluginProcessLink ->
            val notificatie = objectMapper.treeToValue(pluginProcessLink.actionProperties, ReceiveNotificatieProperties::class.java)
            val kanaal = notificatie.kanaal ?: return@mapNotNull null
            val filters = buildMap {
                notificatie.actie?.let { put("actie", it) }
                notificatie.kenmerken?.let { putAll(it) }
            }
            Abonnement.Kanaal(
                naam = kanaal,
                filters = filters
            )
        }
    }

    fun ensureKanalenExist(kanalen: Set<String>) = withLoggingContext(
        PluginConfiguration::class.java.canonicalName to notificatiesApiConfigurationId.toString()
    ) {
        logger.debug { "Ensuring Notificaties API kanalen '$kanalen' exist" }
        val existingKanalen = client.getKanalen(authenticationPluginConfiguration, url).map { it.naam }
        kanalen
            .filter { !existingKanalen.contains(it) }
            .forEach { kanaalNaam ->
                logger.debug { "Attempting to create Notificaties API kanaal with name '$kanaalNaam'" }
                client.createKanaal(authenticationPluginConfiguration, url, Kanaal(naam = kanaalNaam))
                logger.info { "Successfully created Notificaties API kanaal with name '$kanaalNaam'" }
            }
    }

    companion object {
        val logger = KotlinLogging.logger {}
        const val NOTIFICATIES_API_PLUGIN_DEFINITION_KEY = "notificatiesapi"
        const val RECEIVE_NOTIFICATIE_ACTION_KEY = "receive-notificatie"
    }
}
