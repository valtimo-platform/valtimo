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
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
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
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.support.TransactionTemplate
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

    private val manualId: UUID = UUID.randomUUID()
    private val automaticId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        transactionTemplate.executeWithoutResult {
            inboundEventRepository.deleteAll()
            abonnementLinkRepository.deleteAll()
        }

        val manualConfiguration = pluginConfiguration(manualId, "manual", SHARED_SECRET)
        val automaticConfiguration = pluginConfiguration(automaticId, "automatic", null)

        whenever(pluginService.findPluginConfigurations(eq(NotificatiesApiPlugin::class.java), any())).thenAnswer {
            val filter = it.getArgument<(JsonNode) -> Boolean>(1)
            listOf(manualConfiguration, automaticConfiguration).filter { configuration ->
                filter(configuration.properties!!)
            }
        }
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

    private fun pluginConfiguration(id: UUID, registration: String, authHeader: String?): PluginConfiguration {
        val configuration: PluginConfiguration = mock()
        val properties = MapperSingleton.get().valueToTree<ObjectNode>(
            mapOf("abonnementRegistration" to registration, "authHeader" to authHeader)
        )
        whenever(configuration.id).thenReturn(PluginConfigurationId.existingId(id))
        whenever(configuration.properties).thenReturn(properties)
        return configuration
    }

    private companion object {
        const val SHARED_SECRET = "a-plain-shared-secret"
    }
}
