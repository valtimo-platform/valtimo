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

package com.ritense.notificatiesapi

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.NOTIFICATIES_API_PLUGIN_DEFINITION_KEY
import com.ritense.notificatiesapi.NotificatiesApiPlugin.Companion.RECEIVE_NOTIFICATIE_ACTION_KEY
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.AbonnementRegistration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName.RECEIVE_TASK_END
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID

class NotificatiesApiKanaalFiltersTest {

    private val pluginProcessLinkRepository: PluginProcessLinkRepository = mock()
    private val automaticId = UUID.randomUUID()
    private val manualId = UUID.randomUUID()

    private lateinit var automaticPlugin: NotificatiesApiPlugin
    private lateinit var manualPlugin: NotificatiesApiPlugin
    private lateinit var automaticListener: NotificatiesApiListener
    private lateinit var manualListener: NotificatiesApiListener
    private lateinit var kanaalFilters: NotificatiesApiKanaalFilters

    @BeforeEach
    fun setUp() {
        automaticPlugin = notificatiesApiPlugin(automaticId, AbonnementRegistration.AUTOMATIC)
        manualPlugin = notificatiesApiPlugin(manualId, AbonnementRegistration.MANUAL)
        automaticListener = listener(automaticPlugin, AUTOMATIC_LISTENER_KANAAL)
        manualListener = listener(manualPlugin, MANUAL_LISTENER_KANAAL)

        whenever(
            pluginProcessLinkRepository.findByPluginDefinitionKeyAndPluginActionDefinitionKey(
                NOTIFICATIES_API_PLUGIN_DEFINITION_KEY,
                RECEIVE_NOTIFICATIE_ACTION_KEY
            )
        ).thenReturn(
            listOf(
                receiveLink(automaticId, "zaken", "create"),
                receiveLink(manualId, "documenten", "update"),
            )
        )

        kanaalFilters = NotificatiesApiKanaalFilters(
            listOf(automaticPlugin, manualPlugin, automaticListener, manualListener)
        )
    }

    @Test
    fun `should leave listeners of a manual configuration out of automatic registration`() {
        assertThat(kanaalFilters.automaticListeners()).containsExactly(automaticPlugin, automaticListener)
    }

    @Test
    fun `should leave receive-notificatie filters of a manual configuration out of an automatic abonnement`() {
        assertThat(kanaalFilters.automaticKanaalFilters(automaticPlugin))
            .containsExactly(Abonnement.Kanaal(naam = "zaken", filters = mapOf("actie" to "create")))
    }

    @Test
    fun `should return only the filters that belong to a manual configuration`() {
        assertThat(kanaalFilters.manualKanaalFilters(manualId)).containsExactlyInAnyOrder(
            Abonnement.Kanaal(naam = "documenten", filters = mapOf("actie" to "update")),
            MANUAL_LISTENER_KANAAL,
        )
    }

    @Test
    fun `should report a manual configuration on its Notificaties API URL only`() {
        assertThat(kanaalFilters.hasManualConfiguration(URI(NOTIFICATIES_API_URL))).isTrue()
        assertThat(kanaalFilters.hasManualConfiguration(URI(NOTIFICATIES_API_URL.trimEnd('/')))).isTrue()
        assertThat(kanaalFilters.hasManualConfiguration(URI("http://other.example.com/api/v1/"))).isFalse()
    }

    @Test
    fun `should keep every filter in automatic registration when no configuration is manual`() {
        manualPlugin.abonnementRegistration = AbonnementRegistration.AUTOMATIC
        val withoutManual = NotificatiesApiKanaalFilters(
            listOf(automaticPlugin, manualPlugin, automaticListener, manualListener)
        )

        assertThat(withoutManual.automaticListeners())
            .containsExactly(automaticPlugin, manualPlugin, automaticListener, manualListener)
        assertThat(withoutManual.automaticKanaalFilters(automaticPlugin))
            .isEqualTo(automaticPlugin.getKanaalFilters())
        assertThat(withoutManual.hasManualConfiguration(URI(NOTIFICATIES_API_URL))).isFalse()
    }

    private fun notificatiesApiPlugin(id: UUID, registration: AbonnementRegistration) =
        NotificatiesApiPlugin(
            PluginConfigurationId.existingId(id),
            mock(),
            MapperSingleton.get(),
            pluginProcessLinkRepository
        ).apply {
            url = URI(NOTIFICATIES_API_URL)
            callbackUrl = URI("http://localhost:8080/api/v1/notificatiesapi/callback")
            authenticationPluginConfiguration = mock()
            abonnementRegistration = registration
        }

    private fun listener(plugin: NotificatiesApiPlugin, kanaal: Abonnement.Kanaal): NotificatiesApiListener =
        object : NotificatiesApiListener {
            override fun getNotificatiesApiPlugin() = plugin
            override fun getKanaalFilters() = listOf(kanaal)
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
        const val NOTIFICATIES_API_URL = "http://localhost:9999/notificaties/api/v1/"
        val AUTOMATIC_LISTENER_KANAAL = Abonnement.Kanaal(naam = "objecten", filters = mapOf("objectType" to "a"))
        val MANUAL_LISTENER_KANAAL = Abonnement.Kanaal(naam = "objecten", filters = mapOf("objectType" to "m"))
    }
}
