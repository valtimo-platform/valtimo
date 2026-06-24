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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.result.DeployDocumentDefinitionResult
import com.ritense.document.service.result.DeployDocumentDefinitionResultFailed
import com.ritense.document.service.result.DeployDocumentDefinitionResultSucceeded
import com.ritense.document.service.result.error.DocumentDefinitionError
import com.ritense.logging.withLoggingContext
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.security.access.AccessDeniedException

@Service
class BuildingBlockDocumentDefinitionService(
    private val repository: JsonSchemaDocumentDefinitionRepository,
    private val definitionChecker: BuildingBlockDefinitionChecker,
    private val objectMapper: ObjectMapper,
) {
    @Transactional
    fun ensureEmptyFor(key: String, versionTag: String): JsonSchemaDocumentDefinition {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val id = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, buildingBlockId)

        val existing = repository.findById(id)

        if (existing.isPresent) {
            return existing.get()
        }

        val entity = JsonSchemaDocumentDefinition(id, emptySchemaForName(id.name()))
        return repository.save(entity)
    }

    fun deploy(
        jsonSchema: JsonSchema,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): DeployDocumentDefinitionResult {
        try {
            val resolvedSchema = applyKeyOverride(jsonSchema, buildingBlockDefinitionId.key)
            definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
            val documentDefinitionName = resolvedSchema.schema.id.replace(".schema", "")

            return withLoggingContext(
                "documentDefinitionName",
                documentDefinitionName,
                {
                    val documentDefinitionId =
                        JsonSchemaDocumentDefinitionId.forBuildingBlock(documentDefinitionName, buildingBlockDefinitionId)
                    logger.info {
                        "Deploying schema ${resolvedSchema.schema.id} for building block definition $buildingBlockDefinitionId"
                    }

                    val documentDefinition = JsonSchemaDocumentDefinition(documentDefinitionId, resolvedSchema)
                    store(documentDefinition)
                    return DeployDocumentDefinitionResultSucceeded(documentDefinition)
                }
            )
        } catch (ex: AccessDeniedException) {
            throw ex
        } catch (ex: Exception) {
            val error = DocumentDefinitionError { ex.message }
            logger.warn { ex.message }
            return DeployDocumentDefinitionResultFailed(listOf(error))
        }
    }

    fun store(documentDefinition: JsonSchemaDocumentDefinition): JsonSchemaDocumentDefinition {
        return withLoggingContext(
            JsonSchemaDocumentDefinition::class.java,
            documentDefinition.id.toString(),
            {
                definitionChecker.assertCanUpdateBuildingBlockDefinition(documentDefinition.id.buildingBlockDefinitionId())

                repository.saveAndFlush(documentDefinition)
            }
        )
    }

    private fun applyKeyOverride(jsonSchema: JsonSchema, key: String): JsonSchema {
        val json = jsonSchema.asJson()
        val currentName = json.get("\$id")?.asText()?.replace(".schema", "")
        return if (currentName == key) {
            jsonSchema
        } else {
            (json as ObjectNode).put("\$id", "$key.schema")
            JsonSchema.fromString(objectMapper.writeValueAsString(json))
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

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
