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

import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.everit.json.schema.ArraySchema
import org.everit.json.schema.BooleanSchema
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ConstSchema
import org.everit.json.schema.EnumSchema
import org.everit.json.schema.NumberSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema

class BuildingBlockFieldService(
    private val jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository
) {

    fun getFields(
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): List<BuildingBlockFieldDto> {
        val documentDefinition = resolveDocumentDefinition(buildingBlockDefinitionId) ?: return emptyList()

        return documentDefinition.schema.getSchema().walkFields(path = "", requiredInParent = false)
    }

    private fun resolveDocumentDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): JsonSchemaDocumentDefinition? {
        val documentDefinitionId =
            JsonSchemaDocumentDefinitionId.forBuildingBlock(buildingBlockDefinitionId.key, buildingBlockDefinitionId)
        return jsonSchemaDocumentDefinitionRepository.findById(documentDefinitionId).orElse(null)
    }

    private fun Schema.walkFields(path: String, requiredInParent: Boolean): List<BuildingBlockFieldDto> {
        return when (this) {
            is ObjectSchema -> {
                propertySchemas.flatMap { (key, sub) ->
                    sub.walkFields(path = "$path/$key", requiredInParent = key in requiredProperties)
                }
            }

            is ArraySchema ->
                listOf(BuildingBlockFieldDto(name = path, required = requiredInParent)) +
                        allItemSchema?.walkFields(path = path, requiredInParent = false).orEmpty()

            is ReferenceSchema ->
                referredSchema?.walkFields(path = path, requiredInParent = requiredInParent).orEmpty()

            is CombinedSchema ->
                subschemas.flatMap { it.walkFields(path = path, requiredInParent = requiredInParent) }
                    .distinctBy { it.name }

            is StringSchema, is NumberSchema, is BooleanSchema, is EnumSchema, is ConstSchema ->
                listOf(BuildingBlockFieldDto(name = path, required = requiredInParent))

            else -> emptyList()
        }
    }
}
