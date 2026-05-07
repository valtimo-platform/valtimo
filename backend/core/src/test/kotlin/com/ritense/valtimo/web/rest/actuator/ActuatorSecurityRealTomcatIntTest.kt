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

package com.ritense.valtimo.web.rest.actuator

import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.service.ProcessDefinitionCaseDefinitionLinker
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.web.client.RestTemplate
import org.springframework.web.client.exchange
import java.util.Base64

@ExtendWith(SpringExtension::class)
@Tag("security")
@SpringBootTest(
    webEnvironment = WebEnvironment.RANDOM_PORT,
    properties = [
        "management.endpoints.web.base-path=/management",
        "management.endpoints.web.exposure.include=health,info",
        "management.endpoint.health.show-details=when_authorized",
        "management.endpoint.health.roles=ROLE_ACTUATOR",
        "management.endpoint.health.probes.enabled=true",
        "management.endpoint.health.group.liveness.include=livenessState",
        "management.endpoint.health.group.liveness.show-details=ALWAYS",
        "management.endpoint.health.group.readiness.include=readinessState",
        "management.endpoint.health.group.readiness.show-details=ALWAYS",
        "valtimo.security.whitelist.hosts=localhost"
    ]
)
class ActuatorSecurityRealTomcatIntTest @Autowired constructor(
    @LocalServerPort private val serverPort: Int,
    @MockitoBean private val userManagementService: UserManagementService,
    @MockitoBean private val processDefinitionCaseDefinitionLinker: ProcessDefinitionCaseDefinitionLinker
) {

    @Test
    fun `anonymous can read management health on real tomcat without exposing details`() {
        val restTemplate = RestTemplate()

        val response = restTemplate.exchange<String>(
            url = "http://localhost:$serverPort/management/health",
            method = HttpMethod.GET,
            requestEntity = HttpEntity<Any>(HttpHeaders())
        )

        assertThat(response.statusCode.value()).isEqualTo(200)
        // Even though liveness/readiness groups have show-details=ALWAYS, the wrapper strips
        // components for non-actuator callers.
        assertThat(response.body).doesNotContain("components")
    }

    @Test
    fun `actuator user can access management health on real tomcat`() {
        val restTemplate = RestTemplate()
        val headers = HttpHeaders().apply {
            val credentials = Base64.getEncoder().encodeToString("test:test".toByteArray())
            set("Authorization", "Basic $credentials")
        }

        val response = restTemplate.exchange<String>(
            url = "http://localhost:$serverPort/management/health",
            method = HttpMethod.GET,
            requestEntity = HttpEntity<Any>(headers)
        )

        assertThat(response.statusCode.value()).isEqualTo(200)
    }
}
