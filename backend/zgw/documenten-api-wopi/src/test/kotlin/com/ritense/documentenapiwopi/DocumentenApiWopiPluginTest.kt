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

package com.ritense.documentenapiwopi

import com.ritense.documentenapi.DocumentenApiAuthentication
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapiwopi.client.WopiClient
import com.ritense.documentenapiwopi.domain.Action
import com.ritense.documentenapiwopi.domain.App
import com.ritense.documentenapiwopi.domain.NetZone
import com.ritense.documentenapiwopi.domain.WopiAccessToken
import com.ritense.documentenapiwopi.domain.WopiDiscovery
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals

class DocumentenApiWopiPluginTest {

    private lateinit var documentenApiPlugin: DocumentenApiPlugin
    private lateinit var pluginService: PluginService
    private lateinit var wopiClient: WopiClient

    @BeforeEach
    fun before() {
        documentenApiPlugin = mock<DocumentenApiPlugin>()
        pluginService = mock<PluginService>()
        wopiClient = mock<WopiClient>()

        whenever(pluginService.createInstance<DocumentenApiPlugin>(DOCUMENTEN_API_CONFIGURATION_ID)).thenReturn(documentenApiPlugin)
    }

    @Test
    fun `should return WOPI connection details`() {
        val mockDocumentenApiAuthentication: DocumentenApiAuthentication = mock<DocumentenApiAuthentication>()
        val dummyDocumentId: String = "123"
        val dummyCaseDocumentId: UUID = UUID.randomUUID()
        whenever(documentenApiPlugin.authenticationPluginConfiguration).thenReturn(mockDocumentenApiAuthentication)
        whenever(documentenApiPlugin.url).thenReturn(wopiHostBaseUrl)
        whenever(wopiClient.getWopiAccessToken(any(), any(), any())).thenReturn(wopiAccessToken)
        whenever(wopiClient.getWopiDiscovery(any())).thenReturn(wopiDiscovery)
        whenever(wopiClient.getWopiHostPage(any(), any(), any(), any())).thenReturn("TEST_HTML")

        val plugin = DocumentenApiWopiPlugin(wopiClient, pluginService)
        plugin.documentenApiConfigurationId = DOCUMENTEN_API_CONFIGURATION_ID
        plugin.wopiClientDiscoveryUrl = URI("http://localhost:8080")

        val page: String = plugin.getWopiHostPage(dummyDocumentId, dummyCaseDocumentId)

        assertEquals("TEST_HTML", page)
    }

    companion object {
        private const val DOCUMENTEN_API_CONFIGURATION_ID = "documentenApiConfigurationId"

        private val wopiHostBaseUrl: URI = URI("https://wopihost.example.com")

        private val wopiAccessToken: WopiAccessToken = WopiAccessToken("test", 3600)

        private val wopiDiscovery: WopiDiscovery = WopiDiscovery(
            NetZone(
                name = "https",
                apps = listOf(
                    App(
                        name ="App 1",
                        actions = null,
                        favIconUrl = null,
                    ),
                    App(
                        name ="App 2",
                        actions = emptyList(),
                        favIconUrl = null,
                    ),
                    App(
                        name ="App 3",
                        actions = listOf(
                            Action(
                                name = "App 3 - Action 1",
                                urlSrc = "https://app3.example.com/action1",
                                default = true,
                                ext = null,
                            ),
                            Action(
                                name = "App 3 - Action 2",
                                urlSrc = "https://app3.example.com/action2",
                                default = true,
                                ext = null,
                            ),
                            Action(
                                name = "App 3 - Action 3",
                                urlSrc = "https://app3.example.com/action3",
                                default = true,
                                ext = null,
                            ),
                        ),
                        favIconUrl = null,
                    )
                )
            )
        )
    }
}