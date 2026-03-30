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

package com.ritense.valtimo.web.logging

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.web.client.RestClientCustomizer
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpRequest
import org.springframework.http.MediaType
import org.springframework.http.client.ClientHttpRequestExecution
import org.springframework.http.client.ClientHttpRequestInterceptor
import org.springframework.http.client.ClientHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import kotlin.text.Charsets.UTF_8

@Component
@SkipComponentScan
class LoggingRestClientCustomizer : RestClientCustomizer, ClientHttpRequestInterceptor {

    override fun customize(restClientBuilder: RestClient.Builder) {
        restClientBuilder.requestInterceptor(this)
    }

    override fun intercept(
        request: HttpRequest,
        requestBody: ByteArray,
        execution: ClientHttpRequestExecution
    ): ClientHttpResponse {
        val response = execution.execute(request, requestBody)
        val requestBodyHead = requestBody.take(DEFAULT_BUFFER_SIZE).toByteArray()
        return CopiedHeadClientHttpResponse(response) { responseBodyHead ->
            val report = createRequestReport(request, requestBodyHead, response, responseBodyHead)
            logger.debug { report }
            if (response.statusCode.isError) {
                throw HttpClientErrorException(
                    report,
                    response.statusCode,
                    response.statusText,
                    response.headers,
                    responseBodyHead,
                    UTF_8
                )
            }
        }
    }

    private fun createRequestReport(
        request: HttpRequest,
        requestBody: ByteArray,
        response: ClientHttpResponse,
        responseBody: ByteArray
    ): String {
        return """
            |Request:
            |HTTP Method = ${request.method}
            |Request URI = ${request.uri}
            |Headers = ${redactHeaders(request.headers)}
            |Body = ${getFormattedBody(requestBody, request.headers.contentType)}
            |---------------------------------------
            |Response:
            |Status = ${response.statusCode}
            |Headers = ${redactHeaders(response.headers)}
            |Content type = ${response.headers.contentType}
            |Body = ${getFormattedBody(responseBody, response.headers.contentType)}
        |""".trimMargin()
    }

    private fun redactHeaders(headers: HttpHeaders): Map<String, List<String>> {
        return headers.entries.associate { (name, values) ->
            if (SENSITIVE_HEADERS.any { it.equals(name, ignoreCase = true) }) {
                name to listOf(REDACTED)
            } else {
                name to values
            }
        }
    }

    private fun getFormattedBody(body: ByteArray, contentType: MediaType?): String {
        val bodyString = String(body)
        return if (isJsonContentType(contentType)) {
            formatJson(bodyString)
        } else {
            bodyString
        }
    }

    private fun isJsonContentType(contentType: MediaType?): Boolean {
        return contentType?.includes(MediaType.APPLICATION_JSON) == true ||
                contentType?.subtype?.contains("json", ignoreCase = true) == true
    }

    /**
     * Formats a JSON string, into a human-readable, indented structure.
     *
     * @param json the raw JSON string to format (possibly incomplete or malformed)
     * @return a best-effort pretty-printed version of the JSON string
     */
    private fun formatJson(json: String): String {
        val sb = StringBuilder()
        var indent = 0
        var inQuotes = false

        for (char in json) {
            when (char) {
                '"' -> {
                    sb.append(char)
                    inQuotes = !inQuotes
                }
                '{', '[' -> {
                    sb.append(char)
                    if (!inQuotes) {
                        sb.append('\n')
                        sb.append("  ".repeat(++indent))
                    }
                }
                '}', ']' -> {
                    if (!inQuotes) {
                        sb.append('\n')
                        sb.append("  ".repeat(--indent))
                    }
                    sb.append(char)
                }
                ',' -> {
                    sb.append(char)
                    if (!inQuotes) {
                        sb.append('\n')
                        sb.append("  ".repeat(indent))
                    }
                }
                else -> sb.append(char)
            }
        }

        return sb.toString()
    }

    companion object {
        val logger = KotlinLogging.logger {}

        private const val REDACTED = "REDACTED"

        internal val SENSITIVE_HEADERS = setOf(
            "Authorization",
            "X-Api-Key",
            "X-API-Key",
            "Proxy-Authorization",
            "Cookie",
            "Set-Cookie",
            "WWW-Authenticate",
            "X-Auth-Token",
        )
    }
}
