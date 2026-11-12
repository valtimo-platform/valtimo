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

package com.ritense.exchange.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactNotInstallableException
import com.ritense.exchange.exception.ExchangeArtifactTooLargeException
import com.ritense.exchange.exception.ExchangeDisabledException
import com.ritense.exchange.exception.ExchangeUnavailableException
import com.ritense.exchange.service.ExchangeInstallService
import com.ritense.exchange.web.rest.dto.ExchangeArtifactDto
import com.ritense.exchange.web.rest.dto.ExchangeConfigurationDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api")
class ExchangeResource(
    private val service: ExchangeInstallService,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get Exchange integration configuration",
        nl = "Exchange-integratieconfiguratie ophalen",
    )
    @GetMapping("/v1/exchange/configuration", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getConfiguration(): ResponseEntity<ExchangeConfigurationDto> =
        ResponseEntity.ok(service.getConfiguration())

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get Exchange artifact details for installation",
        nl = "Exchange-artefactgegevens voor installatie ophalen",
    )
    @GetMapping(
        "/management/v1/exchange/publications/{publicationId}/artifacts/{artifactId}",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun getArtifact(
        @PathVariable publicationId: UUID,
        @PathVariable artifactId: UUID,
    ): ResponseEntity<ExchangeArtifactDto> =
        ResponseEntity.ok(service.getArtifact(publicationId, artifactId))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Download Exchange artifact for installation",
        nl = "Exchange-artefact voor installatie downloaden",
    )
    @GetMapping("/management/v1/exchange/publications/{publicationId}/artifacts/{artifactId}/content")
    fun getArtifactContent(
        @PathVariable publicationId: UUID,
        @PathVariable artifactId: UUID,
    ): ResponseEntity<ByteArray> {
        val (fileName, content) = service.getArtifactContent(publicationId, artifactId)
        val disposition = ContentDisposition.attachment()
            .filename(sanitize(fileName) ?: "$artifactId.zip")
            .build()
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .body(content)
    }

    @ExceptionHandler(ExchangeDisabledException::class, ExchangeArtifactNotFoundException::class)
    fun handleNotFound(e: RuntimeException) = errorResponse(HttpStatus.NOT_FOUND, e)

    @ExceptionHandler(ExchangeArtifactNotInstallableException::class)
    fun handleNotInstallable(e: RuntimeException) = errorResponse(HttpStatus.UNPROCESSABLE_ENTITY, e)

    @ExceptionHandler(ExchangeArtifactTooLargeException::class)
    fun handleTooLarge(e: RuntimeException) = errorResponse(HttpStatus.PAYLOAD_TOO_LARGE, e)

    @ExceptionHandler(ExchangeUnavailableException::class)
    fun handleUnavailable(e: RuntimeException) = errorResponse(HttpStatus.BAD_GATEWAY, e)

    private fun errorResponse(status: HttpStatus, e: RuntimeException): ResponseEntity<Map<String, String?>> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("message" to e.message))

    private fun sanitize(fileName: String?): String? =
        fileName
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.replace(Regex("[^A-Za-z0-9._-]"), "_")
            ?.trim('.')
            ?.takeIf { it.isNotBlank() }
}
