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
import org.springframework.data.elasticsearch.annotations.MultiField
import java.time.LocalDateTime

/**
 * OpenSearch read model for [com.ritense.document.domain.impl.JsonSchemaDocument].
 *
 * Uses [Map] types for dynamic content and typed classes for known structure fields.
 * [definitionId] uses [OsDefinitionId] / [OsBlueprintId] so sub-fields are mapped as
 * [FieldType.Keyword] directly — avoids unnecessary text analysis and removes the need
 * for `.keyword` suffix in term queries.
 *
 * The [contentText] field holds space-separated leaf values from [content] and is indexed
 * as both [FieldType.Text] (for analyzed search) and [FieldType.Keyword] (for wildcard search
 * preserving partial-match behaviour equivalent to MongoDB's text index).
 */
@Document(indexName = "json_schema_document", createIndex = false)
data class JsonSchemaDocumentOsDocument(
    @Id val id: String,
    @Field(type = FieldType.Object) val content: Map<String, Any?>?,
    @Field(type = FieldType.Object) val definitionId: OsDefinitionId?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val createdOn: LocalDateTime?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val modifiedOn: LocalDateTime?,
    @Field(type = FieldType.Keyword) val createdBy: String?,
    @Field(type = FieldType.Long) val sequence: Long?,
    @Field(type = FieldType.Integer) val version: Int?,
    @Field(type = FieldType.Keyword) val assigneeId: String?,
    @Field(type = FieldType.Keyword) val assigneeFullName: String?,
    @Field(type = FieldType.Keyword) val internalStatus: String?,
    @Field(type = FieldType.Object) val caseTags: List<OsCaseTag>?,
    @Field(type = FieldType.Object, enabled = false) val relations: Any?,
    @Field(type = FieldType.Object, enabled = false) val relatedFiles: Any?,
    @Field(type = FieldType.Date, format = [], pattern = ["uuuu-MM-dd'T'HH:mm:ss.SSS"]) val retentionDate: LocalDateTime?,
    @MultiField(
        mainField = Field(type = FieldType.Text),
        otherFields = [InnerField(suffix = "keyword", type = FieldType.Keyword)],
    )
    val contentText: String? = null,
)

data class OsDefinitionId(
    @Field(type = FieldType.Keyword) val name: String?,
    @Field(type = FieldType.Long) val version: Long?,
    @Field(type = FieldType.Object) val blueprintId: OsBlueprintId?,
)

data class OsBlueprintId(
    @Field(type = FieldType.Keyword) val blueprintType: String?,
    @Field(type = FieldType.Keyword) val blueprintKey: String?,
    @Field(type = FieldType.Keyword) val blueprintVersionTag: String?,
    @Field(type = FieldType.Boolean) val isBuildingBlock: Boolean?,
    @Field(type = FieldType.Boolean) val isCase: Boolean?,
)

data class OsCaseTag(
    @Field(type = FieldType.Keyword) val key: String?,
    @Field(type = FieldType.Keyword) val name: String?,
)
