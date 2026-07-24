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

package com.valtimo.keycloak

import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.mail.MailSender
import com.ritense.valtimo.service.ProcessDefinitionCaseDefinitionLinker
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.junit.jupiter.SpringExtension

@SpringBootTest
@ExtendWith(SpringExtension::class)
@Tag("integration")
abstract class BaseIntegrationTest {

    @MockitoBean
    lateinit var processDefinitionCaseDefinitionLinker: ProcessDefinitionCaseDefinitionLinker

    @MockitoBean
    lateinit var mailSender: MailSender

    @MockitoBean
    lateinit var userManagementService: UserManagementService

    companion object {

        // Started eagerly (before the Spring context) on an OS-assigned free port, so @DynamicPropertySource can
        // expose that port to the OIDC configuration that Spring Security resolves and validates during startup.
        // This avoids depending on a fixed port, which could clash with an outbound socket and cause a BindException.
        val server: MockWebServer = MockWebServer().apply {
            dispatcher = keycloakDispatcher()
            start()
        }

        private val issuerUri: String
            get() = server.url("/auth/realms/valtimo").toString()

        @JvmStatic
        @DynamicPropertySource
        fun keycloakProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.security.oauth2.client.provider.keycloakjwt.issuer-uri") { issuerUri }
            registry.add("spring.security.oauth2.client.provider.keycloakapi.issuer-uri") { issuerUri }
            registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri") {
                "$issuerUri/protocol/openid-connect/certs"
            }
        }

        private fun keycloakDispatcher(): Dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.requestLine) {
                    "GET /auth/realms/valtimo/.well-known/openid-configuration HTTP/1.1" ->
                        mockResponse(openIdConfiguration())
                    "GET /auth/admin/serverinfo HTTP/1.1" -> mockResponseFromFile("/data/get-server-info.json")
                    "POST /auth/realms/valtimo/protocol/openid-connect/token HTTP/1.1" ->
                        mockResponseFromFile("/data/grant-token-response.json")
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        private fun openIdConfiguration(): String {
            val baseUrl = server.url("").toString().removeSuffix("/")
            return readFileAsString("/data/get-openid-configuration.json")
                .replace("http://localhost:19152", baseUrl)
        }

        private fun mockResponseFromFile(fileName: String) =
            mockResponse(readFileAsString(fileName))

        private fun mockResponse(response: String) = MockResponse()
            .setResponseCode(200)
            .setHeader("Content-Type", "application/json")
            .setBody(response)

        fun readFileAsString(fileName: String): String = this::class.java.getResource(fileName).readText(Charsets.UTF_8)
    }
}
