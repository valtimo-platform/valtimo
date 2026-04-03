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

package com.ritense.document.mongodb.converter

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.bson.Document
import org.bson.json.JsonMode
import org.bson.json.JsonWriterSettings
import org.springframework.core.convert.converter.Converter
import org.springframework.data.convert.ReadingConverter
import org.springframework.data.convert.WritingConverter

private val RELAXED_JSON = JsonWriterSettings.builder().outputMode(JsonMode.RELAXED).build()

/**
 * Converts a Jackson [JsonNode] to a BSON [Document] so that Spring Data MongoDB
 * stores the actual JSON structure rather than Jackson's internal object fields.
 * Only applicable to object-typed [JsonNode] fields (e.g. [definitionId]).
 * Array-typed fields should use [Any] instead of [JsonNode] to avoid this converter.
 */
@WritingConverter
class JsonNodeWriteConverter : Converter<JsonNode, Document> {
    override fun convert(source: JsonNode): Document = Document.parse(source.toString())
}

/**
 * Converts a BSON [Document] back to a Jackson [JsonNode] when reading a [JsonNode]-typed field.
 */
@ReadingConverter
class DocumentToJsonNodeReadConverter(private val objectMapper: ObjectMapper) : Converter<Document, JsonNode> {
    override fun convert(source: Document): JsonNode =
        objectMapper.readTree(source.toJson(RELAXED_JSON))
}

/**
 * Converts a BSON [Document] back to a Jackson [ObjectNode] when reading an [ObjectNode]-typed field.
 */
@ReadingConverter
class DocumentToObjectNodeReadConverter(private val objectMapper: ObjectMapper) : Converter<Document, ObjectNode> {
    override fun convert(source: Document): ObjectNode =
        objectMapper.readTree(source.toJson(RELAXED_JSON)) as ObjectNode
}
