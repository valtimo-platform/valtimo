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

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.zalando.problem.AbstractThrowableProblem;
import org.zalando.problem.Status;
import org.zalando.problem.ThrowableProblem;

/**
 * Base for Valtimo exceptions translated to RFC7807 Problem responses.
 *
 * <p>Captures the repeated boilerplate: {@link ErrorConstants#DEFAULT_TYPE}, the
 * {@code message} / {@code params} alert pair, and optional cause. Subclasses pass
 * the short error key (without the {@code "error."} prefix) and the accompanying
 * parameter value.
 *
 * <p>Implemented in Java to avoid Kotlin/Java interop friction around the
 * {@link org.zalando.problem.ThrowableProblem#getCause()} covariant return type.
 */
public abstract class ValtimoProblem extends AbstractThrowableProblem {

    protected ValtimoProblem(String message, Status status, String errorKey, String params) {
        this(ErrorConstants.DEFAULT_TYPE, message, status, errorKey, params, null);
    }

    protected ValtimoProblem(String message, Status status, String errorKey, String params, Throwable cause) {
        this(ErrorConstants.DEFAULT_TYPE, message, status, errorKey, params, cause);
    }

    protected ValtimoProblem(URI type, String message, Status status, String errorKey, String params, Throwable cause) {
        super(type, message, status, null, null, asThrowableProblem(cause), alertParameters(errorKey, params));
        if (cause != null && !(cause instanceof ThrowableProblem)) {
            addSuppressed(cause);
        }
    }

    private static ThrowableProblem asThrowableProblem(Throwable cause) {
        return cause instanceof ThrowableProblem throwableProblem ? throwableProblem : null;
    }

    private static Map<String, Object> alertParameters(String errorKey, String params) {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("message", "error." + errorKey);
        parameters.put("params", params);
        return parameters;
    }
}
