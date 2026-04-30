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

package com.ritense.documentenapipreview.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.documentenapipreview.BaseIntegrationTest
import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.documentenapipreview.domain.PdfArchiveMethod
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

    @BeforeAll
    internal fun setUp() {
        server = MockWebServer()
        setupMockPdfConversionServer()
        server.start()

        doCallRealMethod().whenever(pluginService).createPluginConfiguration(any(), any(), any())

        documentenApiPreviewPlugin = pluginService.createInstance("fdb489a2-e352-4431-a36a-8d708c90aff7") as DocumentenApiPreviewPlugin
        documentenApiPreviewPlugin.pdfConversionUrl = server.url("/").toUri()
    }

    @AfterAll
    internal fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `should allow document conversion`() {
        val stream = pdfConversionClient.convertDocument(
            documentenApiPreviewPlugin.pdfConversionUrl,
            "test_document".byteInputStream(),
            "dummy_file.txt",
            PdfArchiveMethod.PDFA2B,
            true
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