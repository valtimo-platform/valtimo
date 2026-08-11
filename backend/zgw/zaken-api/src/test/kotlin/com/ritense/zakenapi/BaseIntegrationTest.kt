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

package com.ritense.zakenapi

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.service.PluginService
import com.ritense.resource.service.ResourceService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.mail.MailSender
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.service.ZaakDocumentService
import okhttp3.mockwebserver.MockResponse
import java.util.UUID
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.context.junit.jupiter.SpringExtension

@SpringBootTest(classes = [TestApplication::class])
@ExtendWith(SpringExtension::class)
@Tag("integration")
class BaseIntegrationTest {
    @MockitoSpyBean
    lateinit var pluginService: PluginService

    @MockitoSpyBean
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @MockitoBean
    lateinit var mailSender: MailSender

    @MockitoBean
    lateinit var userManagementService: UserManagementService

    @Autowired
    lateinit var zaakUrlProvider: ZaakUrlProvider

    @Autowired
    lateinit var zaakInstanceLinkService: ZaakInstanceLinkService

    @MockitoBean
    lateinit var resourceProvider: ResourceProvider

    @MockitoBean
    lateinit var resourceService: ResourceService

    @MockitoSpyBean
    lateinit var zaakDocumentService: ZaakDocumentService

    fun mockResponse(body: String): MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }

    /**
     * Points a deployed plugin configuration at the given (typically randomly assigned) mock server URL,
     * so integration tests do not depend on a fixed port. Returns the previous URL so callers that run
     * outside a rolled-back transaction (e.g. @BeforeAll) can restore it afterwards.
     */
    protected fun setPluginConfigurationUrl(pluginConfigurationId: String, url: String): String {
        val id = PluginConfigurationId.existingId(UUID.fromString(pluginConfigurationId))
        val configuration = pluginService.getPluginConfiguration(id)
        val properties: ObjectNode = configuration.properties!!.deepCopy()
        val previousUrl = properties.get("url")?.asText() ?: ""
        properties.put("url", url)
        pluginService.updatePluginConfiguration(id, configuration.title, properties)
        return previousUrl
    }
}
