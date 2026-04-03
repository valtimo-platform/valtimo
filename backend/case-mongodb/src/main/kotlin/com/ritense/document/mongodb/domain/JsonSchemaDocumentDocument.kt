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

package com.ritense.document.mongodb.domain

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.document.web.rest.dto.CaseTagResponseDto
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.index.CompoundIndex
import org.springframework.data.mongodb.core.index.CompoundIndexes
import org.springframework.data.mongodb.core.index.TextIndexed
import org.springframework.data.mongodb.core.mapping.Document
import java.time.LocalDateTime

/**
 * MongoDB read model for [com.ritense.document.domain.impl.JsonSchemaDocument].
 *
 * Field names and types mirror the Jackson serialization of the JPA entity:
 * - [definitionId] matches the `definitionId()` getter → [com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId]
 * - [internalStatus] matches the `internalStatus()` getter → plain key String
 * - [caseTags] matches the `caseTags()` getter → [CaseTagResponseDto] list
 * - [relations] matches the `relations()` getter → stored as [Any] (can be array or object) to avoid JPA entity coupling
 * - [relatedFiles] matches the `relatedFiles()` getter → stored as [Any] (RelatedFile is an interface)
 *
 * Indexes follow the ESR rule (Equality → Sort → Range):
 * - The two equality fields that appear in every query are blueprintType + definitionName.
 * - Variants cover the optional equality filters (status, assigneeId) with createdOn as the sort tail.
 * - A separate index covers sequence-based sorting.
 * - A MongoDB text index on [contentText] supports full-text / global search.
 */
@Document(collection = "json_schema_document")
@CompoundIndexes(
    // Base index: no optional filters, sort by creation date (most common case-list query)
    CompoundIndex(
        name = "idx_type_name_created",
        def = "{'definitionId.blueprintId.blueprintType': 1, 'definitionId.name': 1, 'createdOn': -1}",
    ),
    // Status filter + sort by creation date
    CompoundIndex(
        name = "idx_type_name_status_created",
        def = "{'definitionId.blueprintId.blueprintType': 1, 'definitionId.name': 1, 'internalStatus': 1, 'createdOn': -1}",
    ),
    // Assignee filter + sort by creation date
    CompoundIndex(
        name = "idx_type_name_assignee_created",
        def = "{'definitionId.blueprintId.blueprintType': 1, 'definitionId.name': 1, 'assigneeId': 1, 'createdOn': -1}",
    ),
    // Sequence-based sort / filter
    CompoundIndex(
        name = "idx_type_name_sequence",
        def = "{'definitionId.blueprintId.blueprintType': 1, 'definitionId.name': 1, 'sequence': 1}",
    ),
)
data class JsonSchemaDocumentDocument(
    @Id val id: String,
    val content: ObjectNode?,
    val definitionId: JsonNode?,
    val createdOn: LocalDateTime?,
    val modifiedOn: LocalDateTime?,
    val createdBy: String?,
    val sequence: Long?,
    val version: Int?,
    val assigneeId: String?,
    val assigneeFullName: String?,
    val internalStatus: String?,
    val caseTags: List<CaseTagResponseDto>?,
    val relations: Any?,
    val relatedFiles: Any?,
    val retentionDate: LocalDateTime?,
    @TextIndexed val contentText: String? = null,
)
