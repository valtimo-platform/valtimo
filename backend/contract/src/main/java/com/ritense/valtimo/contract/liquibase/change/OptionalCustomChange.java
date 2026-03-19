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

package com.ritense.valtimo.contract.liquibase.change;

import liquibase.change.custom.CustomChange;
import liquibase.change.custom.CustomTaskChange;
import liquibase.database.Database;
import liquibase.exception.CustomChangeException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OptionalCustomChange implements CustomTaskChange {

    private static final Logger logger = LoggerFactory.getLogger(OptionalCustomChange.class);

    private String delegateClass;
    private ResourceAccessor resourceAccessor;
    private CustomChange delegate;
    private boolean delegateResolved;

    @Override
    public String getConfirmationMessage() {
        CustomChange resolved = resolveDelegate();
        if (resolved == null) {
            return "Optional custom change skipped (missing class: " + delegateClass + ")";
        }
        return resolved.getConfirmationMessage();
    }

    @Override
    public void setUp() throws SetupException {
        CustomChange resolved = resolveDelegate();
        if (resolved != null) {
            resolved.setUp();
        }
    }

    @Override
    public void setFileOpener(ResourceAccessor resourceAccessor) {
        this.resourceAccessor = resourceAccessor;
        CustomChange resolved = resolveDelegate();
        if (resolved != null) {
            resolved.setFileOpener(resourceAccessor);
        }
    }

    @Override
    public ValidationErrors validate(Database database) {
        CustomChange resolved = resolveDelegate();
        if (resolved == null) {
            return new ValidationErrors();
        }
        return resolved.validate(database);
    }

    @Override
    public void execute(Database database) throws CustomChangeException {
        CustomChange resolved = resolveDelegate();
        if (resolved instanceof CustomTaskChange) {
            ((CustomTaskChange) resolved).execute(database);
        }
    }

    public String getDelegateClass() {
        return delegateClass;
    }

    public void setDelegateClass(String delegateClass) {
        this.delegateClass = delegateClass;
    }

    private CustomChange resolveDelegate() {
        if (delegateResolved) {
            return delegate;
        }
        delegateResolved = true;
        if (delegateClass == null || delegateClass.isBlank()) {
            logger.warn("OptionalCustomChange delegateClass is empty; skipping.");
            return null;
        }
        try {
            ClassLoader loader = Thread.currentThread().getContextClassLoader();
            if (loader == null) {
                loader = OptionalCustomChange.class.getClassLoader();
            }
            Class<?> candidate = Class.forName(delegateClass, true, loader);
            if (!CustomChange.class.isAssignableFrom(candidate)) {
                logger.warn("OptionalCustomChange delegateClass {} does not implement CustomChange; skipping.", delegateClass);
                return null;
            }
            delegate = (CustomChange) candidate.getDeclaredConstructor().newInstance();
            if (resourceAccessor != null) {
                delegate.setFileOpener(resourceAccessor);
            }
            return delegate;
        } catch (ClassNotFoundException exception) {
            logger.info("OptionalCustomChange delegateClass {} not found; skipping.", delegateClass);
            return null;
        } catch (Exception exception) {
            logger.warn("OptionalCustomChange failed to instantiate {}; skipping.", delegateClass, exception);
            return null;
        }
    }
}
