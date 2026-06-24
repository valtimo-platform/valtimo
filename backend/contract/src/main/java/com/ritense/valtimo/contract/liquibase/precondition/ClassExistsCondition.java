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

package com.ritense.valtimo.contract.liquibase.precondition;

import liquibase.database.Database;
import liquibase.exception.CustomPreconditionErrorException;
import liquibase.exception.CustomPreconditionFailedException;
import liquibase.precondition.CustomPrecondition;

public class ClassExistsCondition implements CustomPrecondition {

    private String className;

    @Override
    public void check(Database database) throws CustomPreconditionFailedException, CustomPreconditionErrorException {
        if (className == null || className.isBlank()) {
            throw new CustomPreconditionErrorException("className is required");
        }
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ClassExistsCondition.class.getClassLoader();
        }
        try {
            Class.forName(className, false, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new CustomPreconditionFailedException("Class not found: " + className, exception);
        } catch (LinkageError error) {
            throw new CustomPreconditionErrorException("Failed to load class: " + className, error);
        }
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }
}
