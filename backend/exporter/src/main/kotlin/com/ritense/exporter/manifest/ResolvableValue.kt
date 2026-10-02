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

package com.ritense.exporter.manifest

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.SerializerProvider
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.StdSerializer

/**
 * A value in the export manifest that is either a literal [StringValue] or a [RefValue] pointing to a
 * field in another file inside the export ZIP.
 *
 * A [RefValue] is serialized as `{ "$ref": "<filePath>#<jsonPointer>" }`, allowing manifest consumers
 * to resolve the value from the referenced file instead of duplicating it in the manifest.
 */
@JsonSerialize(using = ResolvableValueSerializer::class)
sealed interface ResolvableValue {
    companion object {
        fun of(value: String): ResolvableValue = StringValue(value)

        /**
         * @param filePath path of the referenced file inside the export ZIP
         * @param jsonPointer JSON pointer to the field within that file (e.g. `/versionTag`)
         */
        fun ref(filePath: String, jsonPointer: String): ResolvableValue = RefValue("$filePath#$jsonPointer")
    }
}

data class StringValue(val value: String) : ResolvableValue

data class RefValue(val ref: String) : ResolvableValue

class ResolvableValueSerializer : StdSerializer<ResolvableValue>(ResolvableValue::class.java) {
    override fun serialize(value: ResolvableValue, gen: JsonGenerator, provider: SerializerProvider) {
        when (value) {
            is StringValue -> gen.writeString(value.value)
            is RefValue -> {
                gen.writeStartObject()
                gen.writeStringField("\$ref", value.ref)
                gen.writeEndObject()
            }
        }
    }
}
