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

package com.ritense.document.web.rest.error;

import com.ritense.valtimo.contract.web.rest.error.ErrorConstants;
import com.ritense.valtimo.contract.web.rest.error.ExceptionMapper;
import com.ritense.valtimo.contract.web.rest.error.ValtimoProblemDetail;
import jakarta.validation.ValidationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.NativeWebRequest;

public class ValidationExceptionMapper implements ExceptionMapper<ValidationException> {

    @Override
    public Class<ValidationException> getSupportedType() {
        return ValidationException.class;
    }

    @Override
    public ResponseEntity<?> toResponse(ValidationException exception, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.BAD_REQUEST.value());
        problem.setType(ErrorConstants.DEFAULT_TYPE);
        problem.setTitle(exception.getMessage());
        problem.setProperty("message", "error.validationException");
        problem.setProperty("params", exception.getMessage());

        return ResponseEntity.badRequest().body(problem);
    }
}
