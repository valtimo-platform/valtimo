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
import java.util.Collections;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.ErrorResponseException;

/**
 * An exception that is answered with its own RFC 9457 problem body. The {@link ExceptionTranslator} writes
 * the body as it is: the type, title, status, detail and instance, with every parameter as a top-level
 * property. The cause is never part of the body.
 */
public class ProblemException extends ErrorResponseException {

    public ProblemException(URI type, String title, HttpStatusCode status) {
        this(type, title, status, null);
    }

    public ProblemException(URI type, String title, HttpStatusCode status, String detail) {
        this(type, title, status, detail, null, null);
    }

    public ProblemException(
        URI type,
        String title,
        HttpStatusCode status,
        String detail,
        URI instance,
        Map<String, ?> parameters
    ) {
        this(type, title, status, detail, instance, parameters, null);
    }

    public ProblemException(
        URI type,
        String title,
        HttpStatusCode status,
        String detail,
        URI instance,
        Map<String, ?> parameters,
        Throwable cause
    ) {
        super(status, problemDetail(type, title, status, detail, instance, parameters), cause);
    }

    public String getTitle() {
        return getBody().getTitle();
    }

    public String getDetail() {
        return getBody().getDetail();
    }

    public Map<String, Object> getParameters() {
        Map<String, Object> properties = getBody().getProperties();
        return properties == null ? Collections.emptyMap() : Collections.unmodifiableMap(properties);
    }

    @Override
    public String getMessage() {
        return Stream.of(getTitle(), getDetail())
            .filter(Objects::nonNull)
            .collect(Collectors.joining(": "));
    }

    private static ValtimoProblemDetail problemDetail(
        URI type,
        String title,
        HttpStatusCode status,
        String detail,
        URI instance,
        Map<String, ?> parameters
    ) {
        ValtimoProblemDetail problemDetail = new ValtimoProblemDetail(status.value());
        problemDetail.setType(type);
        problemDetail.setTitle(title);
        problemDetail.setDetail(detail);
        problemDetail.setInstance(instance);
        if (parameters != null) {
            parameters.forEach(problemDetail::setProperty);
        }
        return problemDetail;
    }
}
