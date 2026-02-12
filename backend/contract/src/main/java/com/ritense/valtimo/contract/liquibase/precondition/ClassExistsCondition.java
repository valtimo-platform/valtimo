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

package com.ritense.valtimo.contract.liquibase.precondition;

import liquibase.changelog.ChangeSet;
import liquibase.changelog.DatabaseChangeLog;
import liquibase.changelog.visitor.ChangeExecListener;
import liquibase.database.Database;
import liquibase.exception.PreconditionErrorException;
import liquibase.exception.PreconditionFailedException;
import liquibase.exception.ValidationErrors;
import liquibase.exception.Warnings;
import liquibase.precondition.AbstractPrecondition;

public class ClassExistsCondition extends AbstractPrecondition {

    private static final String SERIALIZED_NAMESPACE = "http://www.liquibase.org/xml/ns/dbchangelog";

    private String className;

    @Override
    public String getName() {
        return "classExists";
    }

    @Override
    public String getSerializedObjectNamespace() {
        return SERIALIZED_NAMESPACE;
    }

    @Override
    public Warnings warn(Database database) {
        return new Warnings();
    }

    @Override
    public ValidationErrors validate(Database database) {
        ValidationErrors errors = new ValidationErrors();
        if (className == null || className.isBlank()) {
            errors.addError("className is required");
        }
        return errors;
    }

    @Override
    public void check(
        Database database,
        DatabaseChangeLog changeLog,
        ChangeSet changeSet,
        ChangeExecListener changeExecListener
    ) throws PreconditionFailedException, PreconditionErrorException {
        if (className == null || className.isBlank()) {
            throw new PreconditionErrorException(new IllegalStateException("className is required"), changeLog, this);
        }
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        if (classLoader == null) {
            classLoader = ClassExistsCondition.class.getClassLoader();
        }
        try {
            Class.forName(className, false, classLoader);
        } catch (ClassNotFoundException exception) {
            throw new PreconditionFailedException("Class not found: " + className, changeLog, this);
        } catch (LinkageError error) {
            throw new PreconditionErrorException(
                new IllegalStateException("Failed to load class: " + className, error),
                changeLog,
                this
            );
        }
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }
}
