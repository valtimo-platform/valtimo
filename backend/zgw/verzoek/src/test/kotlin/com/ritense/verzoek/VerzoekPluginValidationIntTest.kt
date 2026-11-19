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

package com.ritense.verzoek

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.document.service.result.DeployDocumentDefinitionResultSucceeded
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.ApplicationStateService
import jakarta.validation.ValidationException
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
internal class VerzoekPluginValidationIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var caseDefinitionRepository: CaseDefinitionRepository

    @Autowired
    lateinit var documentDefinitionService: JsonSchemaDocumentDefinitionService

    @Autowired
    lateinit var applicationStateService: ApplicationStateService

    lateinit var notificatiesApiPluginConfiguration: PluginConfiguration

    lateinit var mockNotificatiesApi: MockWebServer

    @BeforeEach
    fun beforeEach() {
        mockNotificatiesApi = MockWebServer()
        mockNotificatiesApi.start()
        mockNotificatiesApi.enqueue(
            mockResponse(
                """
                [{
                    "url": "http://example.com",
                    "naam": "objecten",
                    "documentatieLink": "http://example.com",
                    "filters": ["objecten"]
                }]
                """.trimIndent()
            )
        )
        mockNotificatiesApi.enqueue(
            mockResponse(
                """
                {
                    "url": "http://example.com/abonnement/test-abonnement",
                    "callbackUrl": "http://example.com/callback",
                    "auth": "Bearer token",
                    "kanalen": [{
                        "filters": { "url": "http://example.com", "someid": "1234" },
                        "naam": "objecten"
                    }]
                }
                """.trimIndent()
            )
        )

        val authenticationConfiguration = createPluginConfiguration(
            "notificatiesapiauthentication",
            """
            {
              "clientId": "my-client-id",
              "clientSecret": "my-extra-long-client-secret-128370192641209486239846"
            }
            """.trimIndent()
        )
        notificatiesApiPluginConfiguration = createPluginConfiguration(
            "notificatiesapi",
            """
            {
              "url": "${mockNotificatiesApi.url("/api/v1/").toUri()}",
              "callbackUrl": "https://example.com/my-callback-api-endpoint",
              "authenticationPluginConfiguration": "${authenticationConfiguration.id.id}"
            }
            """.trimIndent()
        )

        deploy(ACTIVE, active = true, properties = """{ "name": { "type": "string" } }""")
        deploy(
            INACTIVE,
            active = false,
            properties = """{ "name": { "type": "string" }, "newProp": { "type": "string" } }"""
        )
    }

    @AfterEach
    fun tearDown() {
        mockNotificatiesApi.shutdown()
    }

    @Test
    fun `application should be ready so that validation is not skipped`() {
        assertThat(applicationStateService.isApplicationReady()).isTrue()
    }

    @Test
    fun `should accept mapping to a property that only exists in the configured version`() {
        val configuration = createVerzoekConfiguration(target = "doc:/newProp", versionTag = INACTIVE.versionTag.toString())

        assertThat(configuration).isNotNull
    }

    @Test
    fun `should validate against the active version when no version tag is configured`() {
        assertThatThrownBy {
            createVerzoekConfiguration(target = "doc:/newProp", versionTag = null)
        }.hasRootCauseInstanceOf(ValidationException::class.java)
    }

    @Test
    fun `should reject mapping to a property that does not exist in the configured version`() {
        assertThatThrownBy {
            createVerzoekConfiguration(target = "doc:/missing", versionTag = INACTIVE.versionTag.toString())
        }.hasRootCauseInstanceOf(ValidationException::class.java)
    }

    private fun createVerzoekConfiguration(target: String, versionTag: String?): PluginConfiguration {
        val versionTagProperty = versionTag?.let { """"caseDefinitionVersionTag": "$it",""" } ?: ""
        return createPluginConfiguration(
            "verzoek",
            """
            {
              "notificatiesApiPluginConfiguration": "${notificatiesApiPluginConfiguration.id.id}",
              "processToStart": "verzoek-process",
              "rsin": "637549971",
              "verzoekProperties": [{
                "type": "objection",
                "caseDefinitionKey": "$KEY",
                $versionTagProperty
                "processDefinitionKey": "objection-process",
                "objectManagementId": "0b993a22-aa70-49a8-934a-79b17a70df6f",
                "initiatorRoltypeUrl": "https://example.com/my-role-type",
                "initiatorRolDescription": "Initiator",
                "copyStrategy": "specified",
                "mapping": [{
                    "target": "$target",
                    "source": "/name"
                }]
              }]
            }
            """.trimIndent()
        )
    }

    private fun deploy(caseDefinitionId: CaseDefinitionId, active: Boolean, properties: String) {
        caseDefinitionRepository.saveAndFlush(
            CaseDefinition(id = caseDefinitionId, name = KEY, createdDate = null, active = active)
        )
        val result = runWithoutAuthorization {
            documentDefinitionService.deploy(
                """
                    {
                        "${'$'}id": "$KEY.schema",
                        "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                        "type": "object",
                        "properties": $properties,
                        "additionalProperties": false
                    }
                """,
                caseDefinitionId
            )
        }
        assertThat(result).isInstanceOf(DeployDocumentDefinitionResultSucceeded::class.java)
    }

    private fun mockResponse(body: String): MockResponse =
        MockResponse().addHeader("Content-Type", "application/json").setBody(body)

    private fun createPluginConfiguration(pluginDefinitionKey: String, pluginProperties: String): PluginConfiguration =
        pluginService.createPluginConfiguration(
            "my-configuration-$pluginDefinitionKey-${pluginProperties.hashCode()}",
            objectMapper.readTree(pluginProperties).deepCopy(),
            pluginDefinitionKey
        )

    private companion object {
        const val KEY = "verzoek-plugin-validation-int-test"
        val ACTIVE = CaseDefinitionId(KEY, "1.0.0")
        val INACTIVE = CaseDefinitionId(KEY, "1.1.0")
    }
}
