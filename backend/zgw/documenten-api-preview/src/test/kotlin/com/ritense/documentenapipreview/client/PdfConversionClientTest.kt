package com.ritense.documentenapipreview.client

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.apache.commons.fileupload.MultipartStream
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.springframework.http.MediaType
import org.springframework.web.client.RestClient
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.HashMap
import kotlin.test.assertEquals
import kotlin.test.assertTrue


@TestInstance(TestInstance.Lifecycle.PER_CLASS)
internal class PdfConversionClientTest {
    lateinit var mockPdfConversionApi: MockWebServer

    @BeforeAll
    fun setUp() {
        mockPdfConversionApi = MockWebServer()
        mockPdfConversionApi.start()
    }

    @AfterAll
    fun tearDown() {
        mockPdfConversionApi.shutdown()
    }

    @Test
    fun `should send request to correct path`() {
        val restClientBuilder = RestClient.builder()
        val client = PdfConversionClient(restClientBuilder)

        val responseBody = "TEST_PDF_CONTENT"

        mockPdfConversionApi.enqueue(mockResponse(responseBody))

        client.convertDocument(mockPdfConversionApi.url("/").toUri(), "TEST_DOCUMENT".byteInputStream())

        val recordedRequest = mockPdfConversionApi.takeRequest()

        assertEquals("/forms/libreoffice/convert", recordedRequest.path)
    }

    @Test
    fun `should send request with correct form fields`() {
        val restClientBuilder = RestClient.builder()
        val client = PdfConversionClient(restClientBuilder)

        val responseBody = "TEST_PDF_CONTENT"

        mockPdfConversionApi.enqueue(mockResponse(responseBody))

        client.convertDocument(mockPdfConversionApi.url("/").toUri(), "TEST_DOCUMENT".byteInputStream())

        val recordedRequest = mockPdfConversionApi.takeRequest()
        val formFields = parseMultipartFormData(recordedRequest)

        assertTrue(recordedRequest.getHeader("Content-Type")?.startsWith("multipart/form-data") ?: false )
        assertEquals("TEST_DOCUMENT", formFields["files"])
        assertEquals("false",formFields["exportFormFields"])
        assertEquals("PDF/A-1b", formFields["pdfa"])
        assertEquals("true", formFields["pdfua"] )
    }

    private fun mockResponse(body: String): MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/pdf")
            .setBody(body)
    }

    companion object {
        private fun parseMultipartFormData(request: RecordedRequest): Map<String, String> {
            val map = HashMap<String, String>()
            val contentTypeHeader: String? = request.headers["Content-Type"]
            var boundary: String? = null

            if (contentTypeHeader != null) {
                val mediaType: MediaType = MediaType.parseMediaType(contentTypeHeader)
                boundary = mediaType.getParameter("boundary")
            }

            val multipartStream: MultipartStream = MultipartStream(
                ByteArrayInputStream(request.body.readByteArray()),
                boundary!!.toByteArray(),
                1024,
                null
            )

            var nextPart = multipartStream.skipPreamble()
            while (nextPart) {
                val headers = multipartStream.readHeaders()
                println(headers)
                val splitHeaders = headers.split("\n")
                val contentDisposition = splitHeaders.first { it.contains("Content-Disposition") }
                val name = contentDisposition
                    .substring(contentDisposition.indexOf("name=") + 5, contentDisposition.length - 1)
                    .replace("\"","")

                val output: ByteArrayOutputStream = ByteArrayOutputStream()
                multipartStream.readBodyData(output)

                val resource = output.toString()
                map[name] = resource
                nextPart = multipartStream.readBoundary()
            }
            return map;
        }
    }
}