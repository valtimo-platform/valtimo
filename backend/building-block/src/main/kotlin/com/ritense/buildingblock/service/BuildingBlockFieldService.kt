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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

class BuildingBlockFieldService(
    private val jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository
) {

    fun getFields(
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): List<BuildingBlockFieldDto> {
        val documentDefinition = resolveDocumentDefinition(buildingBlockDefinitionId) ?: return emptyList()

        val schemaNode = documentDefinition.schema()
        val requiredProperties = requiredPropertyNames(schemaNode)
        val propertiesNode = schemaNode.get("properties") ?: return emptyList()

        return propertiesNode.fields().asSequence().map { (name, _) ->
            BuildingBlockFieldDto(name = name, required = requiredProperties.contains(name))
        }.toList()
    }

    private fun resolveDocumentDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): JsonSchemaDocumentDefinition? {
        val documentDefinitionId =
            JsonSchemaDocumentDefinitionId.forBuildingBlock(buildingBlockDefinitionId.key, buildingBlockDefinitionId)
        return jsonSchemaDocumentDefinitionRepository.findById(documentDefinitionId).orElse(null)
    }

    private fun requiredPropertyNames(schema: JsonNode): Set<String> {
        val requiredNode = schema.get("required")
        if (requiredNode == null || !requiredNode.isArray) {
            return emptySet()
        }
        return requiredNode.mapNotNull { it.asText(null) }.toSet()
    }
}
