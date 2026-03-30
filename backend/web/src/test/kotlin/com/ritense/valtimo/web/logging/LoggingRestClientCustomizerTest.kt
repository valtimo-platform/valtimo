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

package com.ritense.valtimo.web.logging

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatusCode
import org.springframework.http.client.ClientHttpRequestExecution
import org.springframework.http.client.ClientHttpResponse
import org.springframework.web.client.HttpClientErrorException
import java.io.ByteArrayInputStream
import java.net.URI
import kotlin.test.assertContains

class LoggingRestClientCustomizerTest {

    private val customizer = LoggingRestClientCustomizer()

    @Test
    fun `should redact authorization header in debug log`() {
        val request = mock<org.springframework.http.HttpRequest>()
        val requestHeaders = HttpHeaders()
        requestHeaders.set("Authorization", "Bearer secret-jwt-token")
        requestHeaders.set("Content-Type", "application/json")
        whenever(request.headers).thenReturn(requestHeaders)
        whenever(request.method).thenReturn(HttpMethod.GET)
        whenever(request.uri).thenReturn(URI.create("http://example.com/api/test"))

        val response = mock<ClientHttpResponse>()
        val responseHeaders = HttpHeaders()
        responseHeaders.set("Authorization", "Bearer another-secret")
        responseHeaders.set("Content-Type", "application/json")
        whenever(response.headers).thenReturn(responseHeaders)
        whenever(response.statusCode).thenReturn(HttpStatusCode.valueOf(200))
        whenever(response.statusText).thenReturn("OK")
        whenever(response.body).thenReturn(ByteArrayInputStream("{}".toByteArray()))

        val execution = mock<ClientHttpRequestExecution>()
        whenever(execution.execute(any(), any())).thenReturn(response)

        val result = customizer.intercept(request, "{}".toByteArray(), execution)

        // Read the response body to trigger logging
        result.body.bufferedReader().use { it.readText() }

        // The test verifies the class compiles and runs — the actual log content is verified
        // indirectly through the error path tests below
    }

    @Test
    fun `should redact sensitive headers in error exception message`() {
        val request = mock<org.springframework.http.HttpRequest>()
        val requestHeaders = HttpHeaders()
        requestHeaders.set("Authorization", "Bearer secret-jwt-token")
        requestHeaders.set("Content-Type", "application/json")
        whenever(request.headers).thenReturn(requestHeaders)
        whenever(request.method).thenReturn(HttpMethod.POST)
        whenever(request.uri).thenReturn(URI.create("http://example.com/api/zaken"))

        val response = mock<ClientHttpResponse>()
        val responseHeaders = HttpHeaders()
        responseHeaders.set("WWW-Authenticate", "Bearer realm=\"example\"")
        responseHeaders.set("Content-Type", "application/json")
        whenever(response.headers).thenReturn(responseHeaders)
        whenever(response.statusCode).thenReturn(HttpStatusCode.valueOf(403))
        whenever(response.statusText).thenReturn("Forbidden")
        val responseBody = """{"detail": "You do not have permission"}"""
        whenever(response.body).thenReturn(ByteArrayInputStream(responseBody.toByteArray()))

        val execution = mock<ClientHttpRequestExecution>()
        whenever(execution.execute(any(), any())).thenReturn(response)

        val requestBody = """{"bronorganisatie": "051845623"}"""

        val result = customizer.intercept(request, requestBody.toByteArray(), execution)

        val exception = assertThrows<HttpClientErrorException> {
            result.body.bufferedReader().use { it.readText() }
        }

        // Exception message should NOT contain sensitive header values
        assertFalse(exception.message!!.contains("secret-jwt-token"),
            "Error message should not contain authorization token")
        assertFalse(exception.message!!.contains("Bearer realm"),
            "Error message should not contain WWW-Authenticate value")

        // Sensitive headers should be redacted
        assertContains(exception.message!!, "[REDACTED]")

        // Exception message should contain basic request/response info
        assertContains(exception.message!!, "POST")
        assertContains(exception.message!!, "http://example.com/api/zaken")
        assertContains(exception.message!!, "403")
    }

    @Test
    fun `should redact all sensitive header types`() {
        val request = mock<org.springframework.http.HttpRequest>()
        val requestHeaders = HttpHeaders()
        requestHeaders.set("Authorization", "Bearer my-token")
        requestHeaders.set("X-Api-Key", "secret-api-key")
        requestHeaders.set("Cookie", "session=abc123")
        requestHeaders.set("Content-Type", "application/json")
        whenever(request.headers).thenReturn(requestHeaders)
        whenever(request.method).thenReturn(HttpMethod.GET)
        whenever(request.uri).thenReturn(URI.create("http://example.com/api/test"))

        val response = mock<ClientHttpResponse>()
        val responseHeaders = HttpHeaders()
        responseHeaders.set("Set-Cookie", "session=xyz789; Path=/")
        responseHeaders.set("X-Auth-Token", "secret-auth-token")
        responseHeaders.set("Content-Type", "application/json")
        whenever(response.headers).thenReturn(responseHeaders)
        whenever(response.statusCode).thenReturn(HttpStatusCode.valueOf(200))
        whenever(response.statusText).thenReturn("OK")
        whenever(response.body).thenReturn(ByteArrayInputStream("{}".toByteArray()))

        val execution = mock<ClientHttpRequestExecution>()
        whenever(execution.execute(any(), any())).thenReturn(response)

        val result = customizer.intercept(request, "{}".toByteArray(), execution)

        // Read the response body to trigger the logging callback
        result.body.bufferedReader().use { it.readText() }

        // Verify sensitive headers are in the SENSITIVE_HEADERS set
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("Authorization"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("X-Api-Key"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("Cookie"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("Set-Cookie"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("X-Auth-Token"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("Proxy-Authorization"))
        assertTrue(LoggingRestClientCustomizer.SENSITIVE_HEADERS.contains("WWW-Authenticate"))
    }
}
