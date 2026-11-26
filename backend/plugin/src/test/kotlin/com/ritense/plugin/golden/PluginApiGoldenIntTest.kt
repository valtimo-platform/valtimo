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

package com.ritense.plugin.golden

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.BaseIntegrationTest
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginDefinitionRepository
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.test.golden.GoldenMvc
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType.APPLICATION_JSON
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext

@Transactional
class PluginApiGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Autowired
    lateinit var pluginDefinitionRepository: PluginDefinitionRepository

    @Autowired
    lateinit var encryptionService: EncryptionService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    fun `plugin configurations and definitions keep their JSON`() {
        val configuration = pluginConfigurationRepository.save(
            PluginConfiguration(
                PluginConfigurationId.newId(),
                "golden-config",
                objectMapper.readTree("""{"property1": "my-secret", "property2": "my-normal-property"}""") as ObjectNode,
                pluginDefinitionRepository.getReferenceById("test-plugin"),
                encryptionService,
                objectMapper
            )
        )

        golden("configuration", get("/api/v1/plugin/configuration/{id}", configuration.id.id))
        golden("configurations-by-definition", get("/api/v1/plugin/configuration").param("pluginDefinitionKey", "test-plugin"))
        golden("definitions", get("/api/v1/plugin/definition"))
        golden("definition-actions", get("/api/v1/plugin/definition/{key}/action", "test-plugin"))
        golden(
            "error-create-unknown-definition",
            post("/api/v1/plugin/configuration").contentType(APPLICATION_JSON)
                .content("""{"title": "x", "definitionKey": "does-not-exist", "properties": {}}""")
        )
    }

    private fun golden(name: String, request: MockHttpServletRequestBuilder) {
        val result = mockMvc.perform(request.with { it.apply { remoteAddr = "10.20.30.40" } }).andReturn()
        GoldenMvc.assertMatchesGolden(javaClass, name, result)
    }
}
