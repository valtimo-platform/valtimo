/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.SerializerProvider
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.widget.page.ResolvedPage

@AllOpen
class ResolvedPageSerializer : JsonSerializer<ResolvedPage<*>>() {

    override fun serialize(
        page: ResolvedPage<*>,
        jsonGenerator: JsonGenerator,
        serializerProvider: SerializerProvider
    ) {
        jsonGenerator.writeStartObject()
        jsonGenerator.writeFieldName("content")
        serializerProvider.defaultSerializeValue(page.content, jsonGenerator)

        jsonGenerator.writeBooleanField("first", page.first)
        jsonGenerator.writeBooleanField("last", page.last)
        jsonGenerator.writeNumberField("totalPages", page.totalPages)
        jsonGenerator.writeNumberField("totalElements", page.totalElements)
        jsonGenerator.writeNumberField("numberOfElements", page.numberOfElements)

        jsonGenerator.writeNumberField("size", page.size)
        jsonGenerator.writeNumberField("number", page.number)
        jsonGenerator.writeObjectField("resolved", page.resolved)

        jsonGenerator.writeFieldName("sort")
        serializerProvider.defaultSerializeValue(page.sort, jsonGenerator)

        jsonGenerator.writeEndObject()
    }
}
