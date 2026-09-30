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

package com.ritense.deployerapi.web.rest

import com.ritense.case.exception.UnknownCaseDefinitionException
import com.ritense.deployerapi.web.rest.dto.ErrorResponseDto
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import io.swagger.v3.oas.annotations.Hidden
import org.springframework.beans.TypeMismatchException
import org.springframework.core.Ordered
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.ErrorResponse
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.zalando.problem.Problem

/**
 * Turns failures on the deployer endpoints into the [ErrorResponseDto] shape the published OpenAPI
 * spec promises. Takes precedence over the global problem+json translator, which the deployer's
 * generated client cannot parse.
 *
 * Winning the advice means the global translator's
 * [com.ritense.valtimo.contract.web.rest.error.ExceptionMapper] chain does not run for these
 * endpoints. Two consequences are handled here: statuses are derived locally (see [statusOf]) so
 * framework failures are not flattened into a 500, and messages are only echoed for exceptions
 * whose message Valtimo authors itself — there is no HardeningService to scrub them.
 *
 * Two gaps this cannot close, both because [RestControllerAdvice.assignableTypes] needs a resolved
 * handler method:
 * - Failures raised by request mapping itself (415, 406) still render as problem+json.
 * - Another unrestricted advice at [Ordered.HIGHEST_PRECEDENCE] would tie on order, leaving bean
 *   registration order to decide. Nothing on a deployer path hits one today.
 */
@Hidden
@SkipComponentScan
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = [DeployerCaseDefinitionResource::class])
class DeployerApiExceptionHandler {

    @ExceptionHandler(UnknownCaseDefinitionException::class)
    fun handleUnknownCaseDefinition(exception: UnknownCaseDefinitionException): ResponseEntity<ErrorResponseDto> {
        logger.info(exception) { "Case definition not found" }
        return errorResponse(HttpStatus.NOT_FOUND, exception.messageOr("Case definition not found"))
    }

    @ExceptionHandler(ImportServiceException::class)
    fun handleImportFailure(exception: ImportServiceException): ResponseEntity<ErrorResponseDto> {
        logger.info(exception) { "Import failed" }
        return errorResponse(HttpStatus.BAD_REQUEST, exception.messageOr("Import failed"))
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleInvalidArgument(exception: IllegalArgumentException): ResponseEntity<ErrorResponseDto> {
        logger.info(exception) { "Deployer request carried an invalid argument" }
        return errorResponse(HttpStatus.BAD_REQUEST, exception.messageOr("Invalid request"))
    }

    // Jackson detail leaks internal types and request content — never echo it
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadableRequest(exception: HttpMessageNotReadableException): ResponseEntity<ErrorResponseDto> {
        logger.info(exception) { "Deployer request body could not be read" }
        return errorResponse(HttpStatus.BAD_REQUEST, "Request could not be read")
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(exception: AccessDeniedException): ResponseEntity<ErrorResponseDto> {
        logger.info(exception) { "Deployer request was denied" }
        return errorResponse(HttpStatus.FORBIDDEN, "Access denied")
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(exception: Exception): ResponseEntity<ErrorResponseDto> {
        val status = statusOf(exception)
        return if (status.is5xxServerError) {
            logger.error(exception) { "Deployer request failed unexpectedly" }
            errorResponse(status, "Internal server error")
        } else {
            logger.info(exception) { "Deployer request could not be handled" }
            errorResponse(status, messageOf(exception, status))
        }
    }

    /**
     * Mirrors the status the global translator would have produced for framework failures.
     */
    private fun statusOf(exception: Exception): HttpStatus = when {
        exception is ErrorResponse -> HttpStatus.resolve(exception.statusCode.value())
        // Valtimo carries status on its own exceptions as a zalando Problem
        exception is Problem -> exception.status?.statusCode?.let { HttpStatus.resolve(it) }
        exception is TypeMismatchException -> HttpStatus.BAD_REQUEST
        else -> AnnotatedElementUtils
            .findMergedAnnotation(exception.javaClass, ResponseStatus::class.java)
            ?.code
    } ?: HttpStatus.INTERNAL_SERVER_ERROR

    // A Problem's detail is Valtimo-authored; anything else falls back to the bare status
    private fun messageOf(exception: Exception, status: HttpStatus): String =
        (exception as? Problem)?.detail?.takeIf { it.isNotBlank() } ?: status.reasonPhrase

    private fun errorResponse(status: HttpStatus, message: String) =
        ResponseEntity.status(status).body(ErrorResponseDto(message))

    private fun Throwable.messageOr(fallback: String) = message?.takeIf { it.isNotBlank() } ?: fallback

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
