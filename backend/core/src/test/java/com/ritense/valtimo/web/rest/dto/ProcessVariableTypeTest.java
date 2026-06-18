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

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.variable.value.BooleanValue;
import org.operaton.bpm.engine.variable.value.DoubleValue;
import org.operaton.bpm.engine.variable.value.IntegerValue;
import org.operaton.bpm.engine.variable.value.LongValue;
import org.operaton.bpm.engine.variable.value.ObjectValue;
import org.operaton.bpm.engine.variable.value.StringValue;

class ProcessVariableTypeTest {

    @Test
    void stringRoundTripsAsStringValue() {
        var typed = ProcessVariableType.STRING.toTypedValue("hello");
        assertThat(typed).isInstanceOf(StringValue.class);
        assertThat(((StringValue) typed).getValue()).isEqualTo("hello");
    }

    @Test
    void integerRoundTripsAsIntegerValue() {
        var typed = ProcessVariableType.INTEGER.toTypedValue(42);
        assertThat(typed).isInstanceOf(IntegerValue.class);
        assertThat(((IntegerValue) typed).getValue()).isEqualTo(42);
    }

    @Test
    void longRoundTripsAsLongValue() {
        var typed = ProcessVariableType.LONG.toTypedValue(42L);
        assertThat(typed).isInstanceOf(LongValue.class);
        assertThat(((LongValue) typed).getValue()).isEqualTo(42L);
    }

    @Test
    void doubleRoundTripsAsDoubleValue() {
        var typed = ProcessVariableType.DOUBLE.toTypedValue(1.5);
        assertThat(typed).isInstanceOf(DoubleValue.class);
        assertThat(((DoubleValue) typed).getValue()).isEqualTo(1.5);
    }

    @Test
    void booleanRoundTripsAsBooleanValue() {
        var typed = ProcessVariableType.BOOLEAN.toTypedValue(true);
        assertThat(typed).isInstanceOf(BooleanValue.class);
        assertThat(((BooleanValue) typed).getValue()).isTrue();
    }

    @Test
    void jsonProducesObjectValueWithJsonSerializationFormat() {
        var typed = (ObjectValue) ProcessVariableType.JSON.toTypedValue("{\"a\":1}");
        assertThat(typed.getSerializationDataFormat()).isEqualTo("application/json");
    }

    @Test
    void nullValuesAreAccepted() {
        assertThat(((StringValue) ProcessVariableType.STRING.toTypedValue(null)).getValue()).isNull();
        assertThat(((IntegerValue) ProcessVariableType.INTEGER.toTypedValue(null)).getValue()).isNull();
        assertThat(((BooleanValue) ProcessVariableType.BOOLEAN.toTypedValue(null)).getValue()).isNull();
    }
}
