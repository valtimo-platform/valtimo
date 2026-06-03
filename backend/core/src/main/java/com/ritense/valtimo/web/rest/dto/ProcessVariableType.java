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

package com.ritense.valtimo.web.rest.dto;

import org.operaton.bpm.engine.variable.Variables;
import org.operaton.bpm.engine.variable.value.TypedValue;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public enum ProcessVariableType {
    STRING,
    INTEGER,
    LONG,
    DOUBLE,
    BOOLEAN,
    JSON;

    public TypedValue toTypedValue(Object raw) {
        return switch (this) {
            case STRING -> Variables.stringValue(raw == null ? null : raw.toString());
            case INTEGER -> Variables.integerValue(toInteger(raw));
            case LONG -> Variables.longValue(toLong(raw));
            case DOUBLE -> Variables.doubleValue(toDouble(raw));
            case BOOLEAN -> Variables.booleanValue(toBoolean(raw));
            case JSON -> Variables.objectValue(raw)
                .serializationDataFormat(Variables.SerializationDataFormats.JSON)
                .create();
        };
    }

    private static Integer toInteger(Object raw) {
        if (raw == null) return null;
        long value = toWholeNumber(raw, "INTEGER");
        if (value < Integer.MIN_VALUE || value > Integer.MAX_VALUE) {
            throw badRequest("INTEGER value is out of range");
        }
        return (int) value;
    }

    private static Long toLong(Object raw) {
        if (raw == null) return null;
        return toWholeNumber(raw, "LONG");
    }

    private static long toWholeNumber(Object raw, String typeName) {
        if (raw instanceof Integer i) return i.longValue();
        if (raw instanceof Long l) return l;
        if (raw instanceof Number n) {
            double d = n.doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d) || d != Math.floor(d)) {
                throw badRequest(typeName + " value must be a whole number");
            }
            return n.longValue();
        }
        throw badRequest(typeName + " value must be a number");
    }

    private static Double toDouble(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) return n.doubleValue();
        throw badRequest("DOUBLE value must be a number");
    }

    private static Boolean toBoolean(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Boolean b) return b;
        throw badRequest("BOOLEAN value must be a boolean");
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
