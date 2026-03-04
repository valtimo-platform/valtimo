package com.ritense.documentenapipreview.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.documentenapipreview.BaseIntegrationTest
import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.plugin.domain.PluginConfiguration
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse

import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.mockito.kotlin.any
import org.mockito.kotlin.doCallRealMethod
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertNotNull

@Transactional
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
internal class PdfConversionClientIT @Autowired constructor(
    private val pdfConversionClient: PdfConversionClient,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    lateinit var server: MockWebServer
    lateinit var documentenApiPreviewPlugin: DocumentenApiPreviewPlugin
    lateinit var pluginConfiguration: PluginConfiguration

    @BeforeAll
    internal fun setUp() {
        server = MockWebServer()
        setupMockPdfConversionServer()
        server.start(port = 56273)

        val pluginPropertiesJson = """
            {
              "url": "${server.url("/")}",
              "documentenApiConfigurationId": "5474fe57-532a-4050-8d89-32e62ca3e895"
            }
        """

        doCallRealMethod().whenever(pluginService).createPluginConfiguration(any(), any(), any())

        pluginConfiguration = pluginService.createPluginConfiguration(
            "Documenten API Preview plugin configuration",
            objectMapper.readTree(pluginPropertiesJson) as ObjectNode,
            "documentenapipreview"
        )

        documentenApiPreviewPlugin = pluginService.createInstance(pluginConfiguration.id) as DocumentenApiPreviewPlugin
    }

    @AfterAll
    internal fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `should allow document conversion`() {
        val stream = pdfConversionClient.convertDocument(
            documentenApiPreviewPlugin.url,
            "test_document".byteInputStream()
        )

        assertNotNull(stream)
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
        server.dispatcher = dispatcher
    }

    private fun handlePdfConversionRequest() : MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/pdf")
            .setBody("TEST_DOCUMENT_CONTENT")
    }
}