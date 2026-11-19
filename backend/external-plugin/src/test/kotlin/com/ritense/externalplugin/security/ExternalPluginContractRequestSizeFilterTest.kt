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

package com.ritense.externalplugin.security

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import java.io.ByteArrayInputStream

class ExternalPluginContractRequestSizeFilterTest {

    private val maxPayloadBytes = 1_000
    private val limit = maxPayloadBytes + ExternalPluginContractRequestSizeFilter.ENVELOPE_BYTES
    private val filter = ExternalPluginContractRequestSizeFilter(maxPayloadBytes)

    @Test
    fun `a body within the cap is replayed downstream`() {
        val body = """{"contract":"nl.ritense.openplan@1","operation":"list","payload":{"x":1}}""".toByteArray()
        val chain = MockFilterChain()

        filter.doFilter(request("/api/v1/plugin-contract/call", body), MockHttpServletResponse(), chain)

        val forwarded = chain.request as HttpServletRequest
        assertThat(forwarded.inputStream.readAllBytes()).isEqualTo(body)
        assertThat(forwarded.contentLengthLong).isEqualTo(body.size.toLong())
    }

    @Test
    fun `the replayed body can be read as text`() {
        val chain = MockFilterChain()

        filter.doFilter(request("/api/v1/plugin-contract/jobs", """{"name":"zoë"}""".toByteArray()), MockHttpServletResponse(), chain)

        assertThat((chain.request as HttpServletRequest).reader.readText()).isEqualTo("""{"name":"zoë"}""")
    }

    @Test
    fun `a body exactly at the cap passes, one byte more is refused`() {
        val atCap = MockFilterChain()
        filter.doFilter(request("/api/v1/plugin-contract/call", ByteArray(limit)), MockHttpServletResponse(), atCap)
        assertThat(atCap.request).isNotNull()

        val overCap = MockFilterChain()
        val response = MockHttpServletResponse()
        filter.doFilter(request("/api/v1/plugin-contract/call", ByteArray(limit + 1)), response, overCap)
        assertThat(overCap.request).isNull()
        assertThat(response.status).isEqualTo(413)
    }

    @Test
    fun `an oversized body without a declared length is refused with the contract error envelope`() {
        val chain = MockFilterChain()
        val response = MockHttpServletResponse()
        val streamed = StreamingRequest(request("/api/v1/plugin-contract/jobs", ByteArray(0)), ByteArray(limit * 2))

        filter.doFilter(streamed, response, chain)

        assertThat(chain.request).isNull()
        assertThat(response.status).isEqualTo(413)
        assertThat(response.contentType).startsWith("application/json")
        val body = ObjectMapper().readTree(response.contentAsString)
        assertThat(body.get("status").asText()).isEqualTo("error")
        assertThat(body.get("errorCode").asText()).isEqualTo("PAYLOAD_TOO_LARGE")
        assertThat(body.get("errorMessage").asText()).contains("$limit")
        assertThat(streamed.bytesRead).isEqualTo(limit + 1)
    }

    @Test
    fun `a declared length over the cap is refused without reading the body`() {
        val chain = MockFilterChain()
        val response = MockHttpServletResponse()
        val streamed = StreamingRequest(request("/api/v1/plugin-contract/call", ByteArray(0)), ByteArray(10), declaredLength = limit + 1L)

        filter.doFilter(streamed, response, chain)

        assertThat(response.status).isEqualTo(413)
        assertThat(streamed.bytesRead).isZero()
    }

    @Test
    fun `other paths are left alone`() {
        val chain = MockFilterChain()
        val request = request("/api/v1/document/123", ByteArray(limit * 2))

        filter.doFilter(request, MockHttpServletResponse(), chain)

        assertThat(chain.request).isSameAs(request)
    }

    private fun request(path: String, body: ByteArray) = MockHttpServletRequest("POST", path).apply {
        servletPath = path
        contentType = "application/json"
        characterEncoding = "UTF-8"
        setContent(body)
    }

    /** A request whose body is only available as a stream, counting what the filter consumes. */
    private class StreamingRequest(
        request: HttpServletRequest,
        body: ByteArray,
        private val declaredLength: Long = -1,
    ) : HttpServletRequestWrapper(request) {
        private val source = ByteArrayInputStream(body)
        var bytesRead = 0
            private set

        override fun getContentLengthLong(): Long = declaredLength

        override fun getContentLength(): Int = declaredLength.toInt()

        override fun getInputStream(): ServletInputStream = object : ServletInputStream() {
            override fun read(): Int = source.read().also { if (it >= 0) bytesRead++ }
            override fun isFinished(): Boolean = source.available() == 0
            override fun isReady(): Boolean = true
            override fun setReadListener(readListener: ReadListener) = Unit
        }
    }
}
