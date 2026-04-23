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

package com.ritense.valtimo.service.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import org.operaton.bpm.engine.variable.VariableMap;
import org.operaton.bpm.engine.variable.value.ObjectValue;
import org.operaton.bpm.engine.variable.value.TypedValue;
import org.junit.jupiter.api.Test;

class FormUtilsTest {

    public static final long LONG_VALUE = 10L;
    public static final Date DATE_VALUE = new Date();

    @Test
    void createTypedVariableMap() {
        Map<String, Object> variables = new HashMap<>();
        variables.put("leeftijd", LONG_VALUE);
        variables.put("huidige_tijd", DATE_VALUE);

        VariableMap typedVariableMap = FormUtils.createTypedVariableMap(variables);

        assertThat(typedVariableMap).containsEntry("leeftijd", LONG_VALUE);
        assertThat(typedVariableMap).containsEntry("huidige_tijd", DATE_VALUE);
    }

    @Test
    void createTypedVariableMapShouldNotStoreShortStringAsObjectValue() {
        Map<String, Object> variables = new HashMap<>();
        variables.put("shortText", "hello");

        VariableMap typedVariableMap = FormUtils.createTypedVariableMap(variables);

        TypedValue typedValue = typedVariableMap.getValueTyped("shortText");
        assertThat(typedValue).isNotInstanceOf(ObjectValue.class);
        assertThat(typedValue.getValue()).isEqualTo("hello");
    }

    @Test
    void createTypedVariableMapShouldStoreLongStringAsObjectValue() {
        String longString = "a".repeat(4001);
        Map<String, Object> variables = new HashMap<>();
        variables.put("longText", longString);

        VariableMap typedVariableMap = FormUtils.createTypedVariableMap(variables);

        TypedValue typedValue = typedVariableMap.getValueTyped("longText");
        assertThat(typedValue).isInstanceOf(ObjectValue.class);
        assertThat(typedValue.getValue()).isEqualTo(longString);
    }

    @Test
    void createTypedVariableMapShouldNotStoreStringAtExactLimitAsObjectValue() {
        String exactLimitString = "a".repeat(4000);
        Map<String, Object> variables = new HashMap<>();
        variables.put("exactLimit", exactLimitString);

        VariableMap typedVariableMap = FormUtils.createTypedVariableMap(variables);

        TypedValue typedValue = typedVariableMap.getValueTyped("exactLimit");
        assertThat(typedValue).isNotInstanceOf(ObjectValue.class);
        assertThat(typedValue.getValue()).isEqualTo(exactLimitString);
    }

    @Test
    void createTypedVariableMapShouldStoreStringJustOverLimitAsObjectValue() {
        String overLimitString = "a".repeat(4001);
        Map<String, Object> variables = new HashMap<>();
        variables.put("overLimit", overLimitString);

        VariableMap typedVariableMap = FormUtils.createTypedVariableMap(variables);

        TypedValue typedValue = typedVariableMap.getValueTyped("overLimit");
        assertThat(typedValue).isInstanceOf(ObjectValue.class);
        assertThat(typedValue.getValue()).isEqualTo(overLimitString);
    }

}