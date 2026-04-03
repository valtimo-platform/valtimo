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

package com.ritense.documentenapipreview.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.client.DocumentInformatieObject
import com.ritense.documentenapipreview.BaseIntegrationTest
import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.zgw.Rsin
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.ContentDisposition
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.net.URI
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.util.Optional
import java.util.UUID

@Transactional
internal class DocumentenApiPreviewResourceIT : BaseIntegrationTest() {
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
        setupMockPdfConversionServer()
        mockWebServer.start()

        val mockedId = PluginConfigurationId.existingId(UUID.fromString(DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID))
        mockDocumentenApiPlugin = mock<DocumentenApiPlugin> {}
        doReturn(Optional.of(mock<PluginConfiguration>())).whenever(pluginConfigurationRepository).findById(mockedId)
        doReturn(mockDocumentenApiPlugin).whenever(pluginService).createInstance(mockedId)
        doCallRealMethod().whenever(pluginService).createPluginConfiguration(any(), any(), any())

        pluginConfiguration = pluginService.createPluginConfiguration(
            "Documenten API Preview plugin configuration",
            objectMapper.readTree(
                """
                    {
                        "pdfConversionUrl": "${mockWebServer.url("/")}",
                        "documentenApiConfigurationId": "$DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID"
                    }
                """.trimIndent()
            ) as ObjectNode,
            "documentenapipreview"
        )
    }

    @AfterEach
    fun afterEach() {
        mockWebServer.shutdown()
    }

    @Test
    fun `should generate PDF document from documenten preview API`() {
        doReturn("TEST_DOCUMENT_CONTENT".byteInputStream()).whenever(mockDocumentenApiPlugin).downloadInformatieObject(null,DOCUMENT_ID)
        doReturn(DOCUMENT_INFORMATIE_OBJECT).whenever(mockDocumentenApiPlugin).getInformatieObject(DOCUMENT_ID, null)

        val contentDispositionHeader = ContentDisposition.attachment()
            .filename("mock_document.pdf", StandardCharsets.UTF_8)
            .build()
            .toString()

        mockMvc.perform(
            get(
                "/api/v1/documenten-api-preview/{pluginConfigurationId}/preview/{documentId}",
                DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID,
                DOCUMENT_ID
            )
        )
            .andDo(MockMvcResultHandlers.print())
            .andExpect(header().string("Content-Disposition", contentDispositionHeader))
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(content().string("TEST_DOCUMENT_CONTENT"))
    }

    private fun setupMockPdfConversionServer() {
        val dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.method + " " + request.path?.substringBefore('?')) {
                    "POST /forms/libreoffice/convert" -> handlePdfConversionRequest()
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }
        mockWebServer.dispatcher = dispatcher
    }

    private fun handlePdfConversionRequest() : MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/pdf")
            .setBody("TEST_DOCUMENT_CONTENT")
    }

    companion object {
        private const val DOCUMENT_ID = "mock_document_id"
        private const val DOCUMENTEN_API_PLUGIN_CONFIGURATION_ID = "30a8589b-a686-4849-8e9e-e42f87de59bc"

        private val DOCUMENT_INFORMATIE_OBJECT = DocumentInformatieObject(
            url = URI("http://mock.url/mock_document"),
            bronorganisatie = Rsin("001326132"),
            identificatie = null,
            creatiedatum = LocalDate.now(),
            titel = "Mock titel",
            vertrouwelijkheidaanduiding = null,
            auteur = "Mock auteur",
            status = null,
            formaat = null,
            taal = "Mock taal",
            versie = null,
            beginRegistratie = OffsetDateTime.now(),
            bestandsnaam = "mock_document.docx",
            bestandsomvang = null,
            link = null,
            beschrijving = null,
            ontvangstdatum = null,
            verzenddatum = null,
            indicatieGebruiksrecht = null,
            informatieobjecttype = null,
            trefwoorden = null
        )
    }
}