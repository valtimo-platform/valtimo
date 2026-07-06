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

package com.ritense.documentenapiwopi.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapiwopi.BaseIntegrationTest
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.Optional
import java.util.UUID

@Transactional
internal class DocumentenApiWopiResourceIT : BaseIntegrationTest() {
    @Autowired
    lateinit var objectMapper: ObjectMapper
    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    private lateinit var mockDocumentenApiPlugin: DocumentenApiPlugin
    private lateinit var mockMvc: MockMvc
    private lateinit var mockWebServer: MockWebServer
    private lateinit var pluginConfiguration: PluginConfiguration


    @BeforeEach
    fun beforeEach() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()

        mockWebServer = MockWebServer()
        mockWebServer.start()

        val mockedId = PluginConfigurationId.existingId(UUID.fromString(DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID))
        mockDocumentenApiPlugin = mock<DocumentenApiPlugin> {}
        doReturn(Optional.of(mock<PluginConfiguration>())).whenever(pluginConfigurationRepository).findById(mockedId)
        doReturn(mockDocumentenApiPlugin).whenever(pluginService).createInstance(mockedId)
        doCallRealMethod().whenever(pluginService).createPluginConfiguration(any(), any(), any())

        pluginConfiguration = pluginService.createPluginConfiguration(
            "Documenten API WOPI plugin configuration",
            objectMapper.readTree(
                """
                    {
                        "wopiClientUrl": "https://wopiclient.example.com",
                        "wopiHostUrl": "https://wopihost.example.com",
                        "documentenApiConfigurationId": "$DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID"
                    }
                """.trimIndent()
            ) as ObjectNode,
            "documentenapiwopi"
        )
    }

    @AfterEach
    fun afterEach() {
        mockWebServer.shutdown()
    }

    @Test
    fun `should return true to indicate the documenten api wopi plugin is configured`() {
        mockMvc.perform(
            get(
                "/api/v1/documenten-api-wopi/configuration-exists/{documentenApiConfigurationId}",
                DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID,
            )
        )
            .andDo(MockMvcResultHandlers.print())
            .andExpect(content().string("true"))
    }

    @Test
    fun `should return WOPI connection details`() {
        mockMvc.perform(
            get(
                "/api/v1/documenten-api-wopi/{pluginConfigurationId}/wopi-connection-details/{documentId}",
                DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID,
                DOCUMENT_ID
            )
        )
        .andDo(MockMvcResultHandlers.print())
        .andExpect(MockMvcResultMatchers.status().is2xxSuccessful)
        .andExpect(jsonPath("$").isNotEmpty)
        .andExpect(jsonPath("$.wopi_client_url").value("https://wopiclient.example.com"))
        .andExpect(jsonPath("$.wopi_src").value("https://wopihost.example.com/$DOCUMENT_ID"))
        .andExpect(jsonPath("$.access_token").value("test"))
    }

    companion object {
        private const val DOCUMENT_ID = "mock_document_id"
        private val CASE_DOCUMENT_ID = UUID.randomUUID()
        private const val DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID = "30a8589b-a686-4849-8e9e-e42f87de59bc"
    }
}