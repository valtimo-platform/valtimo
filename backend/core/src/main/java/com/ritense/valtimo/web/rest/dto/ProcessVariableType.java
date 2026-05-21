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
            case INTEGER -> Variables.integerValue(raw == null ? null : ((Number) raw).intValue());
            case LONG -> Variables.longValue(raw == null ? null : ((Number) raw).longValue());
            case DOUBLE -> Variables.doubleValue(raw == null ? null : ((Number) raw).doubleValue());
            case BOOLEAN -> Variables.booleanValue(raw == null ? null : (Boolean) raw);
            case JSON -> Variables.objectValue(raw)
                .serializationDataFormat(Variables.SerializationDataFormats.JSON)
                .create();
        };
    }
}
