/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.ritense.valtimo.contract.annotation.SkipComponentScan;
import com.ritense.valtimo.contract.hardening.service.HardeningService;
import jakarta.annotation.Nonnull;
import jakarta.annotation.Nullable;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindingResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.NativeWebRequest;
import org.zalando.problem.DefaultProblem;
import org.zalando.problem.Problem;
import org.zalando.problem.ProblemBuilder;
import org.zalando.problem.Status;
import org.zalando.problem.ThrowableProblem;
import org.zalando.problem.spring.web.advice.ProblemHandling;
import org.zalando.problem.violations.ConstraintViolationProblem;

/**
 * Controller advice to translate the server side exceptions to client-friendly json structures.
 * The error response follows RFC7807 - Problem Details for HTTP APIs (<a href="https://tools.ietf.org/html/rfc7807">...</a>)
 */
@SkipComponentScan
@ControllerAdvice
public class ExceptionTranslator implements ProblemHandling {

    private static final String MESSAGE = "message";

    private final Optional<HardeningService> hardeningServiceOptional;
    private final List<ExceptionMapper<? extends Throwable>> exceptionMappers;

    public ExceptionTranslator(Optional<HardeningService> hardeningServiceOptional) {
        this(hardeningServiceOptional, Collections.emptyList());
    }

    public ExceptionTranslator(
        Optional<HardeningService> hardeningServiceOptional,
        List<ExceptionMapper<? extends Throwable>> exceptionMappers
    ) {
        this.hardeningServiceOptional = hardeningServiceOptional;
        this.exceptionMappers = exceptionMappers;
    }

    /**
     * Catch-all that consults module-contributed {@link ExceptionMapper}s before falling
     * back to RFC7807 Problem handling. More specific {@code @ExceptionHandler}s on this
     * advice or other advices still take precedence over this one.
     */
    @Override
    @ExceptionHandler(Throwable.class)
    public ResponseEntity<Problem> handleThrowable(@Nonnull Throwable throwable, @Nonnull NativeWebRequest request) {
        for (ExceptionMapper<? extends Throwable> mapper : exceptionMappers) {
            if (mapper.getSupportedType().isInstance(throwable)) {
                @SuppressWarnings("unchecked")
                ExceptionMapper<Throwable> typed = (ExceptionMapper<Throwable>) mapper;
                @SuppressWarnings("unchecked")
                ResponseEntity<Problem> response = (ResponseEntity<Problem>) typed.toResponse(throwable, request);
                return response;
            }
        }
        return create(throwable, request);
    }

    @Override
    public ResponseEntity<Problem> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, @Nonnull NativeWebRequest request) {
        BindingResult result = ex.getBindingResult();
        List<String> fieldErrors = Stream.concat(
                result.getFieldErrors().stream()
                    .map(f -> f.getObjectName() + "." + f.getField() + ": " + f.getDefaultMessage()),
                result.getGlobalErrors().stream()
                    .map(e -> e.getObjectName() + ": " + e.getDefaultMessage())
            )
            .collect(Collectors.toList());

        Problem problem = Problem.builder()
            .withType(ErrorConstants.CONSTRAINT_VIOLATION_TYPE)
            .withTitle("Method argument not valid")
            .withStatus(defaultConstraintViolationStatus())
            .with(MESSAGE, ErrorConstants.ERR_VALIDATION)
            .with("errors", fieldErrors)
            .build();
        return create(ex, problem, request);
    }

    @ExceptionHandler
    public ResponseEntity<Problem> handleNoSuchElementException(NoSuchElementException ex, NativeWebRequest request) {
        Problem problem = Problem.builder()
            .withStatus(Status.NOT_FOUND)
            .with(MESSAGE, ErrorConstants.ENTITY_NOT_FOUND_TYPE)
            .build();
        return create(ex, problem, request);
    }

    @ExceptionHandler
    public ResponseEntity<Problem> handleConcurrencyFailure(ConcurrencyFailureException ex, NativeWebRequest request) {
        Problem problem = Problem.builder()
            .withStatus(Status.CONFLICT)
            .with(MESSAGE, ErrorConstants.ERR_CONCURRENCY_FAILURE)
            .build();
        return create(ex, problem, request);
    }

    @ExceptionHandler
    public ResponseEntity<Problem> handleAccessDenied(AccessDeniedException ex, NativeWebRequest request) {
        Problem problem = Problem.builder()
            .withStatus(Status.FORBIDDEN)
            .with(MESSAGE, ErrorConstants.ERR_ACCESS_DENIED)
            .withDetail(ex.getMessage())
            .build();
        return create(ex, problem, request);
    }

    @ExceptionHandler
    public ResponseEntity<Problem> handleRequestMethodNotSupportedException(HttpRequestMethodNotSupportedException ex, NativeWebRequest request) {
        Problem problem = Problem.builder()
            .withStatus(Status.METHOD_NOT_ALLOWED)
            .with(MESSAGE, ErrorConstants.ERR_METHOD_NOT_SUPPORTED)
            .build();
        return create(ex, problem, request);
    }

    /**
     * Post-process the Problem payload to add the message key for the front-end if needed.
     */
    @Override
    public ResponseEntity<Problem> process(@Nullable ResponseEntity<Problem> entity, NativeWebRequest request) {
        if (entity == null) {
            return entity;
        }
        Problem problem = entity.getBody();
        if (!(problem instanceof ConstraintViolationProblem || problem instanceof DefaultProblem)) {
            return entity;
        }
        ProblemBuilder builder = Problem.builder()
            .withType(Problem.DEFAULT_TYPE.equals(problem.getType()) ? ErrorConstants.DEFAULT_TYPE : problem.getType())
            .withStatus(problem.getStatus())
            .withTitle(problem.getTitle());
        final HttpServletRequest httpServletRequest;
        if ((httpServletRequest = request.getNativeRequest(HttpServletRequest.class)) != null) {
            builder.with("path", httpServletRequest.getRequestURI());
        }

        final String msg = "message";
        if (problem instanceof ConstraintViolationProblem constraintViolationProblem) {
            builder
                .with("errors", constraintViolationProblem.getViolations().stream()
                    .map(v -> v.getField() + ": " + v.getMessage())
                    .toList())
                .with(msg, ErrorConstants.ERR_VALIDATION);
        } else {
            builder
                .withInstance(problem.getInstance());

            problem.getParameters().forEach(builder::with);
            if (!problem.getParameters().containsKey(msg) && problem.getStatus() != null) {
                builder.with(msg, "error.http." + problem.getStatus().getStatusCode());
            }
        }

        builder.withCause(((ThrowableProblem) problem).getCause());
        hardeningServiceOptional.ifPresent(hardeningService -> hardeningService.harden(
            (ThrowableProblem) problem,
            builder,
            (HttpServletRequest) request.getNativeRequest()
        ));

        return new ResponseEntity<>(builder.build(), entity.getHeaders(), entity.getStatusCode());
    }

}
