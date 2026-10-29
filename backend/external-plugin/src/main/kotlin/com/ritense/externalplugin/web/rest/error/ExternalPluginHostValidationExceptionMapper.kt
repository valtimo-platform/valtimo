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

package com.ritense.externalplugin.web.rest.error

import com.ritense.externalplugin.exception.ExternalPluginHostValidationException
import com.ritense.valtimo.contract.web.rest.error.ExceptionMapper
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.context.request.NativeWebRequest

/**
 * Turns an operator-fixable host registration failure into a `400` whose `detail` is the exception's
 * own message. Without this, the catch-all `@ExceptionHandler(Throwable.class)` renders the failure
 * as a `500` with only a reference id, and the add-host modal has nothing to show the admin but a
 * generic error. The body mirrors the RFC7807 fields the frontend already reads (`title`, `status`,
 * `detail`).
 */
class ExternalPluginHostValidationExceptionMapper :
    ExceptionMapper<ExternalPluginHostValidationException> {

    override fun getSupportedType(): Class<ExternalPluginHostValidationException> =
        ExternalPluginHostValidationException::class.java

    override fun toResponse(
        exception: ExternalPluginHostValidationException,
        request: NativeWebRequest,
    ): ResponseEntity<*> = ResponseEntity.badRequest().body(
        ExternalPluginHostValidationErrorResponse(
            title = TITLE,
            status = HttpStatus.BAD_REQUEST.value(),
            detail = exception.message?.takeIf { it.isNotBlank() } ?: TITLE,
        )
    )

    data class ExternalPluginHostValidationErrorResponse(
        val title: String,
        val status: Int,
        val detail: String,
    )

    companion object {
        private const val TITLE = "External plugin host is not valid"
    }
}