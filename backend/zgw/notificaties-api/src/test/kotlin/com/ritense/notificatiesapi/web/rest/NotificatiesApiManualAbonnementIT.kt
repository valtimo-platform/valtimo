/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.notificatiesapi.BaseIntegrationTest
import com.ritense.notificatiesapi.NotificatiesApiListener
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.NOTIFICATIES_API_PLUGIN_DEFINITION_KEY
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.RECEIVE_NOTIFICATIE_ACTION_KEY
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.AbonnementRegistration
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.plugin.service.PluginService
import com.ritense.processlink.domain.ActivityTypeWithEventName.RECEIVE_TASK_END
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.core.task.TaskExecutor
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.support.TransactionTemplate
import java.net.URI
import java.util.UUID

@AutoConfigureMockMvc
class NotificatiesApiManualAbonnementIT : BaseIntegrationTest() {

    @MockBean
    lateinit var pluginService: PluginService

    @MockBean(name = "notificatiesApiAbonnementRegistrationExecutor")
    lateinit var registrationExecutor: TaskExecutor

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var abonnementLinkRepository: NotificatiesApiAbonnementLinkRepository

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    private val pluginProcessLinkRepository: PluginProcessLinkRepository = mock()
    private val manualId: UUID = UUID.randomUUID()
    private val automaticId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        transactionTemplate.executeWithoutResult {
            inboundEventRepository.deleteAll()
            abonnementLinkRepository.deleteAll()
        }

        val manualPlugin = notificatiesApiPlugin(manualId, AbonnementRegistration.MANUAL)
        val automaticPlugin = notificatiesApiPlugin(automaticId, AbonnementRegistration.AUTOMATIC)
        val manualListener = object : NotificatiesApiListener {
            override fun getNotificatiesApiPlugin() = manualPlugin
            override fun getKanaalFilters() = listOf(VERZOEK_KANAAL)
        }
        val automaticListener = object : NotificatiesApiListener {
            override fun getNotificatiesApiPlugin() = automaticPlugin
            override fun getKanaalFilters() = listOf(Abonnement.Kanaal(naam = "objecten", filters = mapOf("x" to "y")))
        }
        val manualConfiguration = pluginConfiguration(manualId, "manual", SHARED_SECRET)
        val automaticConfiguration = pluginConfiguration(automaticId, "automatic", null)
        val manualListenerConfiguration: PluginConfiguration = mock()
        val automaticListenerConfiguration: PluginConfiguration = mock()
        val receiveLinks = listOf(
            receiveLink(manualId, "zaken", "create"),
            receiveLink(automaticId, "documenten", "update"),
        )

        whenever(
            pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(
                NOTIFICATIES_API_PLUGIN_DEFINITION_KEY,
                RECEIVE_NOTIFICATIE_ACTION_KEY
            )
        ).thenReturn(receiveLinks)
        whenever(pluginService.findPluginConfigurations(eq(NotificatiesApiPlugin::class.java), any())).thenAnswer {
            val filter = it.getArgument<(JsonNode) -> Boolean>(1)
            listOf(manualConfiguration, automaticConfiguration).filter { configuration ->
                filter(configuration.properties!!)
            }
        }
        whenever(pluginService.findPluginConfiguration(PluginConfigurationId.existingId(manualId)))
            .thenReturn(manualConfiguration)
        whenever(pluginService.findPluginConfiguration(PluginConfigurationId.existingId(automaticId)))
            .thenReturn(automaticConfiguration)
        whenever(pluginService.createInstance(manualConfiguration)).thenReturn(manualPlugin)
        whenever(pluginService.createInstance(automaticConfiguration)).thenReturn(automaticPlugin)
        whenever(pluginService.createInstance(manualListenerConfiguration)).thenReturn(manualListener)
        whenever(pluginService.createInstance(automaticListenerConfiguration)).thenReturn(automaticListener)
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(
            listOf(manualConfiguration, automaticConfiguration, manualListenerConfiguration, automaticListenerConfiguration)
        )
    }

    @Test
    fun `should accept and queue a notificatie that carries the shared secret of a manual configuration`() {
        mockMvc.perform(callback(SHARED_SECRET)).andExpect(status().isNoContent)

        assertThat(inboundEventRepository.count()).isEqualTo(1)
    }

    @Test
    fun `should reject a notificatie with any other secret`() {
        mockMvc.perform(callback("not-the-shared-secret")).andExpect(status().isUnauthorized)

        assertThat(inboundEventRepository.count()).isZero()
    }

    @Test
    fun `should refuse a notificatie without an authorization header`() {
        mockMvc.perform(callback(null)).andExpect(status().isForbidden)

        assertThat(inboundEventRepository.count()).isZero()
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `should show an admin the kanalen of a manual configuration only`() {
        mockMvc.perform(get(MANUAL_ABONNEMENT_PATH, manualId))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.callbackUrl").doesNotExist())
            .andExpect(jsonPath("$.kanalen.length()").value(2))
            .andExpect(jsonPath("$.kanalen[0].naam").value("zaken"))
            .andExpect(jsonPath("$.kanalen[0].filters.actie").value("create"))
            .andExpect(jsonPath("$.kanalen[1].naam").value("objecten"))
            .andExpect(jsonPath("$.kanalen[1].filters.objectType").value(VERZOEK_OBJECT_TYPE))
            .andExpect(jsonPath("$.kanalen[1].filters.actie").value("create"))
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `should not show kanalen for an automatic configuration`() {
        mockMvc.perform(get(MANUAL_ABONNEMENT_PATH, automaticId)).andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(authorities = [USER])
    fun `should not show the kanalen of a manual configuration to a non-admin`() {
        mockMvc.perform(get(MANUAL_ABONNEMENT_PATH, manualId)).andExpect(status().isForbidden)
    }

    private fun callback(authorization: String?) = post("/api/v1/notificatiesapi/callback")
        .contentType(MediaType.APPLICATION_JSON)
        .content(
            """
            {
                "kanaal": "zaken",
                "hoofdObject": "http://example.com/zaken/1",
                "resource": "zaak",
                "resourceUrl": "http://example.com/zaken/1",
                "actie": "create",
                "aanmaakdatum": "2026-10-21T12:00:00",
                "kenmerken": {}
            }
            """.trimIndent()
        )
        .apply { if (authorization != null) header("Authorization", authorization) }

    private fun notificatiesApiPlugin(id: UUID, registration: AbonnementRegistration) =
        NotificatiesApiPlugin(PluginConfigurationId.existingId(id), mock(), MapperSingleton.get(), pluginProcessLinkRepository)
            .apply {
                url = URI("http://localhost:9999/notificaties/api/v1/")
                if (registration == AbonnementRegistration.AUTOMATIC) callbackUrl = URI(AUTOMATIC_CALLBACK_URL)
                authenticationPluginConfiguration = mock()
                abonnementRegistration = registration
                authHeader = if (registration == AbonnementRegistration.MANUAL) SHARED_SECRET else null
            }

    private fun pluginConfiguration(id: UUID, registration: String, authHeader: String?): PluginConfiguration {
        val configuration: PluginConfiguration = mock()
        val properties = MapperSingleton.get().valueToTree<ObjectNode>(
            mapOf("abonnementRegistration" to registration, "authHeader" to authHeader)
        )
        whenever(configuration.id).thenReturn(PluginConfigurationId.existingId(id))
        whenever(configuration.properties).thenReturn(properties)
        return configuration
    }

    private fun receiveLink(configurationId: UUID, kanaal: String, actie: String) = PluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "process:1",
        activityId = "receive",
        activityType = RECEIVE_TASK_END,
        actionProperties = MapperSingleton.get().valueToTree<ObjectNode>(mapOf("kanaal" to kanaal, "actie" to actie)),
        pluginConfigurationId = PluginConfigurationId.existingId(configurationId),
        pluginActionDefinitionKey = RECEIVE_NOTIFICATIE_ACTION_KEY,
    )

    private companion object {
        const val SHARED_SECRET = "a-plain-shared-secret"
        const val MANUAL_ABONNEMENT_PATH = "/api/management/v1/notificatiesapi/configurations/{id}/manual-abonnement"
        const val AUTOMATIC_CALLBACK_URL = "http://localhost:8080/api/v1/notificatiesapi/callback"
        const val VERZOEK_OBJECT_TYPE = "http://localhost:8011/api/v2/objecttypes/1"
        val VERZOEK_KANAAL = Abonnement.Kanaal(
            naam = "objecten",
            filters = mapOf("objectType" to VERZOEK_OBJECT_TYPE, "actie" to "create")
        )
    }
}
