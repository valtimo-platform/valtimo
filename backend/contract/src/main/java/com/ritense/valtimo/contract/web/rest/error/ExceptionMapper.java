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

package com.ritense.valtimo.contract.web.rest.error;

import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.NativeWebRequest;

/**
 * Module-contributed mapping from a specific {@link Throwable} to an HTTP response.
 *
 * <p>Prefer making your own exceptions extend {@link org.zalando.problem.AbstractThrowableProblem}
 * — the base advice picks those up automatically via Zalando {@code ProblemHandling}. Implement
 * {@code ExceptionMapper} only when:
 *
 * <ul>
 *   <li>the exception type is third-party and cannot be modified, or</li>
 *   <li>the response body must not be an RFC7807 Problem (e.g. a module-specific DTO).</li>
 * </ul>
 *
 * <p>Register implementations as Spring beans; the base advice resolves them by
 * {@link #getSupportedType()} in registration order.
 */
public interface ExceptionMapper<T extends Throwable> {

    Class<T> getSupportedType();

    ResponseEntity<?> toResponse(T exception, NativeWebRequest request);
}
