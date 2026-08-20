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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.documentenapi.DocumentenApiAuthentication
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.client.DocumentInformatieObject
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
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

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
    fun `should select the edit action matching the document's file extension`() {
        val mockDocumentenApiAuthentication: DocumentenApiAuthentication = mock<DocumentenApiAuthentication>()
        val dummyDocumentId: String = "123"
        val dummyCaseDocumentId: UUID = UUID.randomUUID()
        val documentInformatieObject = mock<DocumentInformatieObject>()
        whenever(documentInformatieObject.bestandsnaam).thenReturn("report.docx")
        whenever(documentenApiPlugin.requireModifyAccess(dummyDocumentId, dummyCaseDocumentId)).thenReturn(documentInformatieObject)
        whenever(documentenApiPlugin.authenticationPluginConfiguration).thenReturn(mockDocumentenApiAuthentication)
        whenever(documentenApiPlugin.url).thenReturn(wopiHostBaseUrl)
        whenever(wopiClient.getWopiAccessToken(any(), any(), any())).thenReturn(wopiAccessToken)
        whenever(wopiClient.getWopiDiscovery(any())).thenReturn(wopiDiscovery)
        // Only stub the exact edit/docx URL: if the plugin picks the wrong app, extension or action, this returns null and the test fails.
        whenever(wopiClient.buildWopiHostPageUrl(wopiHostBaseUrl, URI(WORD_EDIT_URL), dummyDocumentId, wopiAccessToken))
            .thenReturn(URI(EXPECTED_HOST_PAGE_URL))

        val plugin = DocumentenApiWopiPlugin(wopiClient, pluginService)
        plugin.documentenApiConfigurationId = DOCUMENTEN_API_CONFIGURATION_ID
        plugin.wopiClientDiscoveryUrl = URI("http://localhost:8080")

        val url: URI = plugin.getWopiHostPageUrl(dummyDocumentId, dummyCaseDocumentId)

        assertEquals(URI(EXPECTED_HOST_PAGE_URL), url)
    }

    @Test
    fun `should fail when discovery has no edit action for the document's file extension`() {
        val mockDocumentenApiAuthentication: DocumentenApiAuthentication = mock<DocumentenApiAuthentication>()
        val dummyDocumentId: String = "123"
        val dummyCaseDocumentId: UUID = UUID.randomUUID()
        val documentInformatieObject = mock<DocumentInformatieObject>()
        whenever(documentInformatieObject.bestandsnaam).thenReturn("presentation.pptx")
        whenever(documentenApiPlugin.requireModifyAccess(dummyDocumentId, dummyCaseDocumentId)).thenReturn(documentInformatieObject)
        whenever(documentenApiPlugin.authenticationPluginConfiguration).thenReturn(mockDocumentenApiAuthentication)
        whenever(documentenApiPlugin.url).thenReturn(wopiHostBaseUrl)
        whenever(wopiClient.getWopiAccessToken(any(), any(), any())).thenReturn(wopiAccessToken)
        whenever(wopiClient.getWopiDiscovery(any())).thenReturn(wopiDiscovery)

        val plugin = DocumentenApiWopiPlugin(wopiClient, pluginService)
        plugin.documentenApiConfigurationId = DOCUMENTEN_API_CONFIGURATION_ID
        plugin.wopiClientDiscoveryUrl = URI("http://localhost:8080")

        assertFailsWith<IllegalStateException> {
            plugin.getWopiHostPageUrl(dummyDocumentId, dummyCaseDocumentId)
        }
    }

    @Test
    fun `should not match a stored config that is missing the documentenApiConfigurationId property`() {
        val propertiesWithoutConfigId = ObjectMapper().readTree("""{"wopiClientDiscoveryUrl": "http://localhost:8080"}""")

        val matches = DocumentenApiWopiPlugin
            .findConfigurationByDocumentenApiConfiguration(DOCUMENTEN_API_CONFIGURATION_ID)
            .invoke(propertiesWithoutConfigId)

        // must not throw and must not match - one malformed stored config should never break the check for every other config
        assertFalse(matches)
    }

    companion object {
        private const val DOCUMENTEN_API_CONFIGURATION_ID = "documentenApiConfigurationId"
        private const val WORD_EDIT_URL = "https://word.example.com/edit"
        private const val EXPECTED_HOST_PAGE_URL = "https://wopihost.example.com/wopi/files/123?access_token=test"

        private val wopiHostBaseUrl: URI = URI("https://wopihost.example.com")

        private val wopiAccessToken: WopiAccessToken = WopiAccessToken("test", 3600)

        // Two apps, each with both a view and an edit action for a distinct extension - mirrors OnlyOffice/Office
        // Online discovery documents, where different apps/extensions have their own urlSrc (unlike Collabora,
        // where a single browser URL is shared across all actions).
        private val wopiDiscovery: WopiDiscovery = WopiDiscovery(
            NetZone(
                name = "https",
                apps = listOf(
                    App(
                        name = "Word",
                        actions = listOf(
                            Action(name = "view", urlSrc = "https://word.example.com/view", default = true, ext = "docx"),
                            Action(name = "edit", urlSrc = WORD_EDIT_URL, default = true, ext = "docx"),
                        ),
                        favIconUrl = null,
                    ),
                    App(
                        name = "Excel",
                        actions = listOf(
                            Action(name = "view", urlSrc = "https://excel.example.com/view", default = true, ext = "xlsx"),
                            Action(name = "edit", urlSrc = "https://excel.example.com/edit", default = true, ext = "xlsx"),
                        ),
                        favIconUrl = null,
                    ),
                )
            )
        )
    }
}