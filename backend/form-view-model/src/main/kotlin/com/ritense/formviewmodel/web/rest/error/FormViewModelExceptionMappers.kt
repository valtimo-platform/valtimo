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

package com.ritense.formviewmodel.web.rest.error

import com.ritense.formviewmodel.error.BusinessException
import com.ritense.formviewmodel.error.FormErrorsException
import com.ritense.formviewmodel.error.FormException
import com.ritense.formviewmodel.web.rest.dto.MultipleFormErrors
import com.ritense.formviewmodel.web.rest.dto.SingleFormError
import com.ritense.valtimo.contract.web.rest.error.ExceptionMapper
import org.springframework.http.ResponseEntity
import org.springframework.web.context.request.NativeWebRequest

private const val UNKNOWN_FORM_ERROR = "Unknown Form Error"
private const val UNKNOWN_BUSINESS_RULE_ERROR = "Unknown Business Rule Error"

class FormExceptionMapper : ExceptionMapper<FormException> {
    override fun getSupportedType(): Class<FormException> = FormException::class.java

    override fun toResponse(exception: FormException, request: NativeWebRequest): ResponseEntity<*> =
        ResponseEntity.badRequest().body(
            SingleFormError(
                error = exception.message ?: UNKNOWN_FORM_ERROR,
                component = exception.component
            )
        )
}

class FormErrorsExceptionMapper : ExceptionMapper<FormErrorsException> {
    override fun getSupportedType(): Class<FormErrorsException> = FormErrorsException::class.java

    override fun toResponse(exception: FormErrorsException, request: NativeWebRequest): ResponseEntity<*> =
        ResponseEntity.badRequest().body(MultipleFormErrors(exception.componentErrors))
}

class BusinessExceptionMapper : ExceptionMapper<BusinessException> {
    override fun getSupportedType(): Class<BusinessException> = BusinessException::class.java

    override fun toResponse(exception: BusinessException, request: NativeWebRequest): ResponseEntity<*> =
        ResponseEntity.badRequest().body(
            SingleFormError(error = exception.message ?: UNKNOWN_BUSINESS_RULE_ERROR)
        )
}
