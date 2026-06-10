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
import org.zalando.problem.Status;

public class BadRequestAlertException extends ValtimoProblem {

    private final String entityName;
    private final String errorKey;

    public BadRequestAlertException(String defaultMessage, String errorKey) {
        this(ErrorConstants.DEFAULT_TYPE, defaultMessage, null, errorKey);
    }

    public BadRequestAlertException(String defaultMessage, String entityName, String errorKey) {
        this(ErrorConstants.DEFAULT_TYPE, defaultMessage, entityName, errorKey, null);
    }

    public BadRequestAlertException(String defaultMessage, String entityName, String errorKey, Throwable cause) {
        this(ErrorConstants.DEFAULT_TYPE, defaultMessage, entityName, errorKey, cause);
    }

    public BadRequestAlertException(URI type, String defaultMessage, String entityName, String errorKey) {
        this(type, defaultMessage, entityName, errorKey, null);
    }

    public BadRequestAlertException(URI type, String defaultMessage, String entityName, String errorKey, Throwable cause) {
        super(type, defaultMessage, Status.BAD_REQUEST, errorKey, entityName, cause);
        this.entityName = entityName;
        this.errorKey = errorKey;
    }

    public String getEntityName() {
        return entityName;
    }

    public String getErrorKey() {
        return errorKey;
    }
}
