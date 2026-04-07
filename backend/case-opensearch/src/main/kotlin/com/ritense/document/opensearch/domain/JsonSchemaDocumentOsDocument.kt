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

package com.ritense.document.opensearch.domain

import org.springframework.data.annotation.Id
import org.springframework.data.elasticsearch.annotations.Document
import org.springframework.data.elasticsearch.annotations.Field
import org.springframework.data.elasticsearch.annotations.FieldType
import org.springframework.data.elasticsearch.annotations.InnerField
import java.time.LocalDateTime

/**
 * OpenSearch read model for [com.ritense.document.domain.impl.JsonSchemaDocument].
 *
 * Uses [Map] types instead of Jackson [com.fasterxml.jackson.databind.JsonNode] / [com.fasterxml.jackson.databind.node.ObjectNode]
 * to avoid needing custom converters — Spring Data OpenSearch serializes Map fields
 * to nested JSON objects natively.
 *
 * The [contentText] field holds space-separated leaf values from [content] and is indexed
 * as both [FieldType.Text] (for analyzed search) and [FieldType.Keyword] (for wildcard search
 * preserving partial-match behaviour equivalent to MongoDB's text index).
 */
@Document(indexName = "json_schema_document", createIndex = false)
data class JsonSchemaDocumentOsDocument(
    @Id val id: String,
    @Field(type = FieldType.Object) val content: Map<String, Any?>?,
    @Field(type = FieldType.Object) val definitionId: Map<String, Any?>?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val createdOn: LocalDateTime?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val modifiedOn: LocalDateTime?,
    @Field(type = FieldType.Keyword) val createdBy: String?,
    @Field(type = FieldType.Long) val sequence: Long?,
    @Field(type = FieldType.Integer) val version: Int?,
    @Field(type = FieldType.Keyword) val assigneeId: String?,
    @Field(type = FieldType.Keyword) val assigneeFullName: String?,
    @Field(type = FieldType.Keyword) val internalStatus: String?,
    @Field(type = FieldType.Object) val caseTags: List<Map<String, Any?>>?,
    @Field(type = FieldType.Object) val relations: Any?,
    @Field(type = FieldType.Object) val relatedFiles: Any?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val retentionDate: LocalDateTime?,
    @Field(
        type = FieldType.Text,
        fields = [InnerField(suffix = "keyword", type = FieldType.Keyword)],
    )
    val contentText: String? = null,
)
