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
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.accept.ContentNegotiationStrategy;
import org.springframework.web.accept.HeaderContentNegotiationStrategy;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.util.DisconnectedClientHelper;

/**
 * Controller advice to translate the server side exceptions to client-friendly json structures.
 * The error response follows RFC 9457 - Problem Details for HTTP APIs (<a href="https://www.rfc-editor.org/rfc/rfc9457">...</a>)
 *
 * <p>A {@link ProblemException} is answered with its own body, and an {@link ExceptionMapper} that returns a
 * {@link ProblemDetail} has it written the same way. Every other exception gets a generic body with
 * the {@code type}, {@code title}, {@code status}, the request {@code path} and a {@code message} key for the
 * front-end. Its detail is only shown to clients that {@link HardeningService} allows to see it.
 */
@SkipComponentScan
@ControllerAdvice
public class ExceptionTranslator {

    private static final Logger logger = LoggerFactory.getLogger(ExceptionTranslator.class);
    private static final String MESSAGE = "message";
    private static final URI BLANK_TYPE = URI.create("about:blank");
    private static final MediaType X_PROBLEM_JSON = MediaType.parseMediaType("application/x.problem+json");
    private static final ContentNegotiationStrategy CONTENT_NEGOTIATION = new HeaderContentNegotiationStrategy();

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
     * back to a generic problem response. More specific {@code @ExceptionHandler}s on this
     * advice or other advices still take precedence over this one.
     */
    @ExceptionHandler(Throwable.class)
    public ResponseEntity<?> handleThrowable(@Nonnull Throwable throwable, @Nonnull NativeWebRequest request) {
        for (ExceptionMapper<? extends Throwable> mapper : exceptionMappers) {
            if (mapper.getSupportedType().isInstance(throwable)) {
                @SuppressWarnings("unchecked")
                ExceptionMapper<Throwable> typed = (ExceptionMapper<Throwable>) mapper;
                ResponseEntity<?> response = typed.toResponse(throwable, request);
                if (response != null && response.getBody() instanceof ProblemDetail problem) {
                    return new ResponseEntity<>(ProblemResponse.of(problem), response.getHeaders(), response.getStatusCode());
                }
                return response;
            }
        }
        return create(throwable, request);
    }

    /**
     * Client gone (broken pipe, async request no longer usable): rethrow so Spring's own
     * disconnected-client handling applies instead of an ERROR log plus a response nobody reads.
     */
    @ExceptionHandler(IOException.class)
    public ResponseEntity<?> handleIoException(IOException ex, @Nonnull NativeWebRequest request) throws IOException {
        if (DisconnectedClientHelper.isClientDisconnectedException(ex)) {
            throw ex;
        }
        return handleThrowable(ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleProblem(ProblemException problem, NativeWebRequest request) {
        return respond(problem, problem.getBody(), problem.getHeaders(), request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleResponseStatusException(ResponseStatusException ex, NativeWebRequest request) {
        HttpStatusCode status = ex.getStatusCode();
        String title = status instanceof HttpStatus httpStatus ? httpStatus.getReasonPhrase() : null;
        return create(status, title, ex, request, new HttpHeaders());
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleUnsupportedOperation(UnsupportedOperationException ex, NativeWebRequest request) {
        return create(HttpStatus.NOT_IMPLEMENTED, ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleMediaTypeNotAcceptable(HttpMediaTypeNotAcceptableException ex, NativeWebRequest request) {
        return create(HttpStatus.NOT_ACCEPTABLE, ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, NativeWebRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(ex.getSupportedMediaTypes());
        return create(HttpStatus.UNSUPPORTED_MEDIA_TYPE, HttpStatus.UNSUPPORTED_MEDIA_TYPE.getReasonPhrase(), ex, request, headers);
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MultipartException.class,
        TypeMismatchException.class,
        MissingServletRequestPartException.class,
        ServletRequestBindingException.class
    })
    public ResponseEntity<ProblemResponse> handleBadRequest(Exception ex, NativeWebRequest request) {
        return create(HttpStatus.BAD_REQUEST, ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleNoHandlerFound(NoHandlerFoundException ex, NativeWebRequest request) {
        return create(HttpStatus.NOT_FOUND, ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleSocketTimeout(SocketTimeoutException ex, NativeWebRequest request) {
        return create(HttpStatus.GATEWAY_TIMEOUT, ex, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleConstraintViolation(ConstraintViolationException ex, NativeWebRequest request) {
        Stream<String[]> violations = ex.getConstraintViolations().stream()
            .map(violation -> new String[]{violation.getPropertyPath().toString(), violation.getMessage()});
        return constraintViolation(ex, violations, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleBindException(BindException ex, NativeWebRequest request) {
        BindingResult result = ex.getBindingResult();
        Stream<String[]> violations = Stream.concat(
            result.getFieldErrors().stream().map(error -> new String[]{error.getField(), error.getDefaultMessage()}),
            result.getGlobalErrors().stream().map(error -> new String[]{error.getObjectName(), error.getDefaultMessage()})
        );
        return constraintViolation(ex, violations, request);
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, @Nonnull NativeWebRequest request) {
        BindingResult result = ex.getBindingResult();
        List<String> fieldErrors = Stream.concat(
                result.getFieldErrors().stream()
                    .map(f -> f.getObjectName() + "." + f.getField() + ": " + f.getDefaultMessage()),
                result.getGlobalErrors().stream()
                    .map(e -> e.getObjectName() + ": " + e.getDefaultMessage())
            )
            .toList();

        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.BAD_REQUEST.value());
        problem.setType(ErrorConstants.CONSTRAINT_VIOLATION_TYPE);
        problem.setTitle("Method argument not valid");
        problem.setProperty(MESSAGE, ErrorConstants.ERR_VALIDATION);
        problem.setProperty("errors", fieldErrors);
        return createGeneric(ex, problem, request, new HttpHeaders());
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleNoSuchElementException(NoSuchElementException ex, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.NOT_FOUND.value());
        problem.setProperty(MESSAGE, ErrorConstants.ENTITY_NOT_FOUND_TYPE);
        return createGeneric(ex, problem, request, new HttpHeaders());
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleConcurrencyFailure(ConcurrencyFailureException ex, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.CONFLICT.value());
        problem.setProperty(MESSAGE, ErrorConstants.ERR_CONCURRENCY_FAILURE);
        return createGeneric(ex, problem, request, new HttpHeaders());
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleAccessDenied(AccessDeniedException ex, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.FORBIDDEN.value());
        problem.setProperty(MESSAGE, ErrorConstants.ERR_ACCESS_DENIED);
        problem.setDetail(ex.getMessage());
        return createGeneric(ex, problem, request, new HttpHeaders());
    }

    @ExceptionHandler
    public ResponseEntity<ProblemResponse> handleRequestMethodNotSupportedException(HttpRequestMethodNotSupportedException ex, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.METHOD_NOT_ALLOWED.value());
        problem.setProperty(MESSAGE, ErrorConstants.ERR_METHOD_NOT_SUPPORTED);
        return createGeneric(ex, problem, request, new HttpHeaders());
    }

    /**
     * Logs a handled exception: client errors as a warning with the message, server errors as an error with
     * the stack trace.
     */
    public void log(Throwable throwable, ProblemDetail problem, NativeWebRequest request, HttpStatusCode status) {
        if (status.is4xxClientError()) {
            logger.warn("{}: {}", reasonPhrase(status), throwable.getMessage());
        } else if (status.is5xxServerError()) {
            logger.error(reasonPhrase(status), throwable);
        }
    }

    /**
     * Creates a generic problem response, with the status of a {@link ResponseStatus} annotation on the
     * exception or one of its causes, and 500 otherwise.
     */
    protected ResponseEntity<ProblemResponse> create(Throwable throwable, NativeWebRequest request) {
        ResponseStatus responseStatus = resolveResponseStatus(throwable);
        if (responseStatus == null) {
            return create(HttpStatus.INTERNAL_SERVER_ERROR, throwable, request);
        }
        String title = responseStatus.reason().isEmpty() ? responseStatus.code().getReasonPhrase() : responseStatus.reason();
        return create(responseStatus.code(), title, throwable, request, new HttpHeaders());
    }

    protected ResponseEntity<ProblemResponse> create(HttpStatus status, Throwable throwable, NativeWebRequest request) {
        return create(status, status.getReasonPhrase(), throwable, request, new HttpHeaders());
    }

    protected ResponseEntity<ProblemResponse> create(
        HttpStatusCode status,
        String title,
        Throwable throwable,
        NativeWebRequest request,
        HttpHeaders headers
    ) {
        ProblemDetail problem = new ValtimoProblemDetail(status.value());
        problem.setTitle(title);
        problem.setDetail(throwable.getMessage());
        return createGeneric(throwable, problem, request, headers);
    }

    private ResponseEntity<ProblemResponse> createGeneric(
        Throwable throwable,
        ProblemDetail problem,
        NativeWebRequest request,
        HttpHeaders headers
    ) {
        ProblemDetail response = new ValtimoProblemDetail(problem.getStatus());
        response.setType(problem.getType() == null || BLANK_TYPE.equals(problem.getType()) ? ErrorConstants.DEFAULT_TYPE : problem.getType());
        response.setTitle(problem.getTitle());
        setPath(response, request);
        response.setInstance(problem.getInstance());
        if (problem.getProperties() != null) {
            problem.getProperties().forEach(response::setProperty);
        }
        if (problem.getProperties() == null || !problem.getProperties().containsKey(MESSAGE)) {
            response.setProperty(MESSAGE, "error.http." + problem.getStatus());
        }
        harden(problem, response, throwable, request);
        return respond(throwable, response, headers, request);
    }

    private ResponseEntity<ProblemResponse> constraintViolation(Throwable throwable, Stream<String[]> violations, NativeWebRequest request) {
        ProblemDetail problem = new ValtimoProblemDetail(HttpStatus.BAD_REQUEST.value());
        problem.setType(ErrorConstants.CONSTRAINT_VIOLATION_PROBLEM_TYPE);
        problem.setTitle("Constraint Violation");
        setPath(problem, request);
        problem.setProperty("errors", violations
            .sorted(Comparator.<String[], String>comparing(violation -> violation[0])
                .thenComparing(violation -> violation[1]))
            .map(violation -> violation[0] + ": " + violation[1])
            .toList());
        problem.setProperty(MESSAGE, ErrorConstants.ERR_VALIDATION);
        harden(problem, problem, throwable, request);
        return respond(throwable, problem, new HttpHeaders(), request);
    }

    private void setPath(ProblemDetail problem, NativeWebRequest request) {
        HttpServletRequest httpServletRequest = request.getNativeRequest(HttpServletRequest.class);
        if (httpServletRequest != null) {
            problem.setProperty("path", httpServletRequest.getRequestURI());
        }
    }

    private void harden(ProblemDetail problem, ProblemDetail response, Throwable throwable, NativeWebRequest request) {
        HttpServletRequest httpServletRequest = request.getNativeRequest(HttpServletRequest.class);
        if (httpServletRequest != null) {
            hardeningServiceOptional.ifPresent(hardeningService ->
                hardeningService.harden(problem, response, throwable, httpServletRequest)
            );
        }
    }

    private ResponseEntity<ProblemResponse> respond(
        Throwable throwable,
        ProblemDetail problem,
        HttpHeaders headers,
        NativeWebRequest request
    ) {
        HttpStatusCode status = HttpStatusCode.valueOf(problem.getStatus());
        log(throwable, problem, request, status);
        if (status.value() == HttpStatus.INTERNAL_SERVER_ERROR.value()) {
            request.setAttribute(RequestDispatcher.ERROR_EXCEPTION, throwable, RequestAttributes.SCOPE_REQUEST);
        }
        return ResponseEntity.status(status)
            .headers(headers)
            .contentType(negotiate(request))
            .body(ProblemResponse.of(problem));
    }

    private MediaType negotiate(NativeWebRequest request) {
        List<MediaType> mediaTypes;
        try {
            mediaTypes = CONTENT_NEGOTIATION.resolveMediaTypes(request);
        } catch (HttpMediaTypeNotAcceptableException e) {
            return MediaType.APPLICATION_PROBLEM_JSON;
        }
        for (MediaType mediaType : mediaTypes) {
            if (mediaType.includes(MediaType.APPLICATION_JSON) || mediaType.includes(MediaType.APPLICATION_PROBLEM_JSON)) {
                return MediaType.APPLICATION_PROBLEM_JSON;
            } else if (mediaType.includes(X_PROBLEM_JSON)) {
                return X_PROBLEM_JSON;
            }
        }
        return MediaType.APPLICATION_PROBLEM_JSON;
    }

    private static ResponseStatus resolveResponseStatus(Throwable throwable) {
        ResponseStatus candidate = AnnotatedElementUtils.findMergedAnnotation(throwable.getClass(), ResponseStatus.class);
        return candidate == null && throwable.getCause() != null ? resolveResponseStatus(throwable.getCause()) : candidate;
    }

    private static String reasonPhrase(HttpStatusCode status) {
        HttpStatus httpStatus = HttpStatus.resolve(status.value());
        return httpStatus == null ? String.valueOf(status.value()) : httpStatus.getReasonPhrase();
    }
}
