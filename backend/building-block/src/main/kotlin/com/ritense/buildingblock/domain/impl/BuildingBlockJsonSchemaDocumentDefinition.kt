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

package com.ritense.document.domain.impl

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.databind.JsonNode
import com.ritense.buildingblock.domain.impl.BuildingBlockJsonSchemaDocumentDefinitionId
import com.ritense.document.domain.DocumentContent
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition.DocumentContentValidationErrorImpl
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition.DocumentContentValidationResultImpl
import com.ritense.document.domain.validation.DocumentContentValidationResult
import com.ritense.document.exception.DocumentDefinitionNameMismatchException
import jakarta.annotation.Nonnull
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.everit.json.schema.ValidationException
import org.springframework.data.domain.AbstractAggregateRoot
import org.springframework.data.domain.Persistable
import java.time.LocalDateTime

@Entity
@Table(name = "building_block_json_schema_document_definition")
class BuildingBlockJsonSchemaDocumentDefinition() :
    AbstractAggregateRoot<BuildingBlockJsonSchemaDocumentDefinition>(),
    DocumentDefinition,
    Persistable<BuildingBlockJsonSchemaDocumentDefinitionId> {

    @EmbeddedId
    private lateinit var id: BuildingBlockJsonSchemaDocumentDefinitionId

    @Embedded
    private lateinit var schema: JsonSchema

    @Column(name = "created_on", columnDefinition = "DATETIME", nullable = false)
    private var createdOn: LocalDateTime = LocalDateTime.now()

    constructor(
        id: BuildingBlockJsonSchemaDocumentDefinitionId,
        schema: JsonSchema
    ) : this() {
        this.id = requireNotNull(id) { "id is required" }
        this.schema = requireNotNull(schema) { "schema is required" }
        assertMatchingSchemaIds(id, schema)
    }

    constructor(id: BuildingBlockJsonSchemaDocumentDefinitionId) : this() {
        this.id = requireNotNull(id) { "id is required" }
        this.schema = emptySchemaForName(id.name())
        assertMatchingSchemaIds(this.id, this.schema)
    }

    override fun id(): BuildingBlockJsonSchemaDocumentDefinitionId = id
    override fun createdOn(): LocalDateTime = createdOn
    override fun schema(): JsonNode = schema.asJson()
    fun getSchemaEmbeddable(): JsonSchema = schema

    override fun validate(documentContent: DocumentContent): DocumentContentValidationResult {
        var content = documentContent
        val errors = try {
            content = schema.validateDocument(content)
            emptyList()
        } catch (e: ValidationException) {
            e.allMessages.map { DocumentContentValidationErrorImpl(it) }
        }
        return DocumentContentValidationResultImpl(errors, content)
    }

    private fun assertMatchingSchemaIds(
        id: BuildingBlockJsonSchemaDocumentDefinitionId,
        schema: JsonSchema
    ) {
        val expected = id.name() + ".schema"
        val actual = schema.getSchema().id
        if (expected != actual) {
            throw DocumentDefinitionNameMismatchException(id, schema)
        }
    }

    private fun emptySchemaForName(name: String): JsonSchema {
        val json = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "$name.schema",
              "type": "object",
              "properties": {}
            }
        """.trimIndent()
        return JsonSchema.fromString(json)
    }

    override fun toString(): String = id.toString()

    @JsonIgnore
    @Nonnull
    override fun getId(): BuildingBlockJsonSchemaDocumentDefinitionId = id

    @JsonIgnore
    override fun isNew(): Boolean = id.isNew
}