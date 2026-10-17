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

package com.ritense.valtimo.operaton.variable

import org.operaton.bpm.engine.impl.variable.serializer.PrimitiveValueSerializer
import org.operaton.bpm.engine.impl.variable.serializer.ValueFields
import org.operaton.bpm.engine.variable.Variables
import org.operaton.bpm.engine.variable.impl.value.UntypedValueImpl
import org.operaton.bpm.engine.variable.type.ValueType
import org.operaton.bpm.engine.variable.value.StringValue
import org.operaton.bpm.engine.variable.value.TypedValue

class LargeStringValueSerializer : PrimitiveValueSerializer<StringValue>(ValueType.STRING) {

    override fun getName() = NAME

    override fun canWriteValue(typedValue: TypedValue): Boolean {
        val value = typedValue.value
        return value is String && value.length > MAX_TEXT_LENGTH
    }

    override fun convertToTypedValue(untypedValue: UntypedValueImpl): StringValue {
        return Variables.stringValue(untypedValue.value as String, untypedValue.isTransient)
    }

    override fun readValue(valueFields: ValueFields, asTransientValue: Boolean): StringValue {
        val value = valueFields.byteArrayValue?.toString(Charsets.UTF_8)
        return Variables.stringValue(value, asTransientValue)
    }

    override fun writeValue(value: StringValue, valueFields: ValueFields) {
        valueFields.byteArrayValue = value.value.toByteArray(Charsets.UTF_8)
    }

    companion object {
        const val NAME = "largeString"

        // The TEXT_ column of the variable tables is of type varchar(4000)
        const val MAX_TEXT_LENGTH = 4000
    }
}
