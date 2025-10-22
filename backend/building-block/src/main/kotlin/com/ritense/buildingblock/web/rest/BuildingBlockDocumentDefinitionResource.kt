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

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.impl.BuildingBlockJsonSchemaDocumentDefinitionId
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.document.domain.impl.BuildingBlockJsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockDocumentDefinitionResource(
    private val repository: BuildingBlockJsonSchemaDocumentDefinitionRepository,
    private val mapper: ObjectMapper
) {

    @GetMapping("/{key}/version/{versionTag}/document")
    fun getDocumentDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<JsonNode> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)
        val definition = repository.findById(id).orElse(null) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(definition.schema())
    }

    @PutMapping("/{key}/version/{versionTag}/document", consumes = [APPLICATION_JSON_UTF8_VALUE])
    @Transactional
    fun updateDocumentDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestBody schemaJson: JsonNode
    ): ResponseEntity<JsonNode> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)

        val schemaString: String = mapper.writeValueAsString(schemaJson)
        val newSchema = JsonSchema.fromString(schemaString)

        val updated = BuildingBlockJsonSchemaDocumentDefinition(id, newSchema)
        val saved = repository.save(updated)

        return ResponseEntity.ok(saved.schema())
    }
}