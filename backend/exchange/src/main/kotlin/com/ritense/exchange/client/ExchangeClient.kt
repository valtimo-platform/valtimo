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

package com.ritense.exchange.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exchange.client.dto.ExchangePublication
import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactTooLargeException
import com.ritense.exchange.exception.ExchangeUnavailableException
import org.springframework.http.MediaType
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.Base64
import java.util.UUID

class ExchangeClient(
    private val restClient: RestClient,
    private val maxArtifactSize: Long,
) {

    fun getPublication(publicationId: UUID): ExchangePublication? =
        try {
            restClient.get()
                .uri("/api/v1/publications/{id}", publicationId)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(ExchangePublication::class.java)
                ?: throw ExchangeUnavailableException("The Exchange returned an empty response")
        } catch (e: HttpClientErrorException.NotFound) {
            null
        } catch (e: RestClientException) {
            throw ExchangeUnavailableException("The Exchange could not be reached", e)
        }

    fun getArtifactContent(publicationId: UUID, artifactId: UUID): ByteArray =
        try {
            restClient.get()
                .uri("/api/v1/publications/{id}/artifacts/{artifactId}", publicationId, artifactId)
                .accept(MediaType.APPLICATION_OCTET_STREAM, MediaType.APPLICATION_JSON)
                .exchange { _, response ->
                    val status = response.statusCode
                    when {
                        status.value() == 404 -> throw ExchangeArtifactNotFoundException("Artifact not found")
                        !status.is2xxSuccessful -> throw ExchangeUnavailableException(
                            "The Exchange responded with status ${status.value()}"
                        )
                    }
                    // Wirespec serialises Bytes as a base64 JSON string
                    val isJson = MediaType.APPLICATION_JSON.isCompatibleWith(response.headers.contentType)
                    val limit = if (isJson) base64Limit() else maxArtifactSize
                    if (response.headers.contentLength > limit) throw tooLarge()
                    val body = response.body.use { readLimited(it, limit) }
                    if (isJson) decodeBase64JsonString(body) else body
                }
                ?: throw ExchangeUnavailableException("The Exchange returned an empty response")
        } catch (e: RestClientException) {
            throw ExchangeUnavailableException("The Exchange could not be reached", e)
        }

    private fun decodeBase64JsonString(body: ByteArray): ByteArray {
        val decoded = try {
            Base64.getDecoder().decode(objectMapper.readValue(body, String::class.java))
        } catch (e: Exception) {
            throw ExchangeUnavailableException("The Exchange returned an unreadable artifact", e)
        }
        if (decoded.size > maxArtifactSize) throw tooLarge()
        return decoded
    }

    private fun base64Limit() = (maxArtifactSize + 2) / 3 * 4 + JSON_QUOTES

    private fun readLimited(input: InputStream, limit: Long): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(BUFFER_SIZE)
        var total = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            if (total > limit) throw tooLarge()
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }

    private fun tooLarge() = ExchangeArtifactTooLargeException(
        "The artifact exceeds the maximum size of ${maxArtifactSize / BYTES_PER_MEGABYTE} MB"
    )

    companion object {
        private val objectMapper = ObjectMapper()
        private const val JSON_QUOTES = 2
        private const val BUFFER_SIZE = 8192
        private const val BYTES_PER_MEGABYTE = 1024 * 1024
    }
}
