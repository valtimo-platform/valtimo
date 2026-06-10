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

package com.ritense.valtimo.web.rest.error;

import com.ritense.valtimo.contract.annotation.SkipComponentScan;
import com.ritense.valtimo.contract.hardening.service.HardeningService;
import com.ritense.valtimo.contract.web.rest.error.ExceptionMapper;
import com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.context.request.NativeWebRequest;
import org.zalando.problem.Problem;

import static com.ritense.logging.LoggingContextKt.withErrorLoggingContext;

/**
 * Layers MDC error-logging context onto the base RFC7807 translator. The base advice already
 * handles framework exceptions and consults {@link ExceptionMapper}s; this subclass exists
 * only to ensure {@code log} runs inside {@code withErrorLoggingContext}.
 */
@SkipComponentScan
@ControllerAdvice
public class WebModuleExceptionTranslator extends ExceptionTranslator {

    public WebModuleExceptionTranslator(Optional<HardeningService> hardeningServiceOptional) {
        super(hardeningServiceOptional);
    }

    public WebModuleExceptionTranslator(
        Optional<HardeningService> hardeningServiceOptional,
        List<ExceptionMapper<? extends Throwable>> exceptionMappers
    ) {
        super(hardeningServiceOptional, exceptionMappers);
    }

    @Override
    public void log(
        final Throwable throwable,
        final Problem problem,
        final NativeWebRequest request,
        final HttpStatus status
    ) {
        withErrorLoggingContext(() -> {
            super.log(throwable, problem, request, status);
            return null;
        });
    }
}
