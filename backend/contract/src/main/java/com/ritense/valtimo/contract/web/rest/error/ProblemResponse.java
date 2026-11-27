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

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.net.URI;
import java.util.Map;
import org.springframework.http.ProblemDetail;

/**
 * The body of an error response: a {@link ProblemDetail} written as it is. Spring adds the request path as
 * {@code instance} to every {@link ProblemDetail} body it writes, which Valtimo's error responses leave out,
 * so the {@link ExceptionTranslator} writes this wrapper instead.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@JsonPropertyOrder({"type", "title", "status", "detail", "instance"})
public final class ProblemResponse {

    private final ProblemDetail problem;

    private ProblemResponse(ProblemDetail problem) {
        this.problem = problem;
    }

    public static ProblemResponse of(ProblemDetail problem) {
        return new ProblemResponse(problem);
    }

    @JsonProperty("type")
    public URI getType() {
        return problem.getType();
    }

    @JsonProperty("title")
    public String getTitle() {
        return problem.getTitle();
    }

    @JsonProperty("status")
    public int getStatus() {
        return problem.getStatus();
    }

    @JsonProperty("detail")
    public String getDetail() {
        return problem.getDetail();
    }

    @JsonProperty("instance")
    public URI getInstance() {
        return problem.getInstance();
    }

    @JsonAnyGetter
    public Map<String, Object> getProperties() {
        return problem.getProperties();
    }

    @JsonIgnore
    public ProblemDetail getProblem() {
        return problem;
    }
}
