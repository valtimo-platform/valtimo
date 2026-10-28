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

import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.security.web.util.matcher.AntPathRequestMatcher
import org.springframework.web.filter.OncePerRequestFilter
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.nio.charset.Charset

/**
 * Caps the body of requests under `/api/v1/plugin-contract` before anything parses it: the payload
 * limit plus an allowance for the JSON envelope. The body is buffered up to the cap and replayed downstream.
 */
class ExternalPluginContractRequestSizeFilter(maxPayloadBytes: Int) : OncePerRequestFilter() {

    private val maxBodyBytes: Int = (maxPayloadBytes.toLong() + ENVELOPE_BYTES).coerceAtMost(Int.MAX_VALUE - 1L).toInt()

    override fun shouldNotFilter(request: HttpServletRequest): Boolean = !CONTRACT_MATCHER.matches(request)

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        if (request.contentLengthLong > maxBodyBytes) {
            reject(response)
            return
        }
        val body = request.inputStream.readNBytes(maxBodyBytes + 1)
        if (body.size > maxBodyBytes) {
            reject(response)
            return
        }
        filterChain.doFilter(BufferedBodyRequest(request, body), response)
    }

    private fun reject(response: HttpServletResponse) {
        response.status = HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        response.writer.write(
            """{"status":"error","errorCode":"PAYLOAD_TOO_LARGE",""" +
                """"errorMessage":"The request body exceeds the maximum of $maxBodyBytes bytes"}"""
        )
    }

    private class BufferedBodyRequest(request: HttpServletRequest, private val body: ByteArray) :
        HttpServletRequestWrapper(request) {

        private val stream = BufferedServletInputStream(body)

        override fun getInputStream(): ServletInputStream = stream

        override fun getReader(): BufferedReader {
            val charset = characterEncoding?.let { runCatching { Charset.forName(it) }.getOrNull() } ?: Charsets.UTF_8
            return BufferedReader(InputStreamReader(stream, charset))
        }

        override fun getContentLength(): Int = body.size

        override fun getContentLengthLong(): Long = body.size.toLong()
    }

    private class BufferedServletInputStream(body: ByteArray) : ServletInputStream() {
        private val delegate = ByteArrayInputStream(body)

        override fun read(): Int = delegate.read()

        override fun read(b: ByteArray, off: Int, len: Int): Int = delegate.read(b, off, len)

        override fun isFinished(): Boolean = delegate.available() == 0

        override fun isReady(): Boolean = true

        override fun setReadListener(readListener: ReadListener) {
            throw UnsupportedOperationException("The buffered contract request body is read synchronously")
        }
    }

    companion object {
        /** Room for `contract`, `operation`, `replyTo` and the other envelope fields around the payload. */
        const val ENVELOPE_BYTES = 65_536

        private val CONTRACT_MATCHER = AntPathRequestMatcher("/api/v1/plugin-contract/**")
    }
}
