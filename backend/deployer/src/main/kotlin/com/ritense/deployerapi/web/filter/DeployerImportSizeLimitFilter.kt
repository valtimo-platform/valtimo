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

package com.ritense.deployerapi.web.filter

import com.ritense.deployerapi.web.rest.dto.ErrorResponseDto
import com.ritense.valtimo.contract.json.MapperSingleton
import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.util.unit.DataSize
import org.springframework.web.filter.OncePerRequestFilter
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.Charset
import java.nio.charset.StandardCharsets

class DeployerImportSizeLimitFilter(
    maxRequestSize: DataSize,
) : OncePerRequestFilter() {

    private val maxBytes = maxRequestSize.toBytes()

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.contentLengthLong > maxBytes) {
            response.status = HttpStatus.PAYLOAD_TOO_LARGE.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.characterEncoding = StandardCharsets.UTF_8.name()
            response.writer.write(
                MapperSingleton.get().writeValueAsString(ErrorResponseDto(RequestBodyTooLargeException(maxBytes).message!!))
            )
            return
        }
        filterChain.doFilter(SizeLimitedRequest(request, maxBytes), response)
    }

    private class SizeLimitedRequest(
        request: HttpServletRequest,
        maxBytes: Long,
    ) : HttpServletRequestWrapper(request) {

        private val limitedInputStream by lazy { SizeLimitedInputStream(request.inputStream, maxBytes) }

        override fun getInputStream(): ServletInputStream = limitedInputStream

        override fun getReader(): BufferedReader {
            val charset = characterEncoding?.let { Charset.forName(it) } ?: StandardCharsets.ISO_8859_1
            return BufferedReader(InputStreamReader(limitedInputStream, charset))
        }
    }

    private class SizeLimitedInputStream(
        private val delegate: ServletInputStream,
        private val maxBytes: Long,
    ) : ServletInputStream() {

        private var bytesRead = 0L

        override fun read(): Int = delegate.read().also { if (it != -1) count(1) }

        override fun read(b: ByteArray, off: Int, len: Int): Int =
            delegate.read(b, off, len).also { if (it > 0) count(it) }

        override fun isFinished(): Boolean = delegate.isFinished

        override fun isReady(): Boolean = delegate.isReady

        override fun setReadListener(readListener: ReadListener) = delegate.setReadListener(readListener)

        override fun close() = delegate.close()

        private fun count(bytes: Int) {
            bytesRead += bytes
            if (bytesRead > maxBytes) {
                throw RequestBodyTooLargeException(maxBytes)
            }
        }
    }
}
