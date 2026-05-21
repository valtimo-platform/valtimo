/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.processlink.web.rest.error

import com.ritense.processlink.validation.ProcessDefinitionValidationError
import com.ritense.processlink.validation.ProcessDefinitionValidationException
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.context.request.NativeWebRequest

@SkipComponentScan
@ControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class ProcessDefinitionValidationExceptionTranslator {

    @ExceptionHandler(ProcessDefinitionValidationException::class)
    fun handleValidationException(
        ex: ProcessDefinitionValidationException,
        request: NativeWebRequest
    ): ResponseEntity<ProcessDefinitionValidationErrorResponse> {
        return ResponseEntity
            .unprocessableEntity()
            .body(ProcessDefinitionValidationErrorResponse(ex.errors))
    }

    data class ProcessDefinitionValidationErrorResponse(
        val errors: List<ProcessDefinitionValidationError>
    )
}
