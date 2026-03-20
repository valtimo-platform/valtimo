/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.objectmanagement.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_FORM
import com.ritense.importer.ValtimoImportTypes.Companion.OBJECT_MANAGEMENT
import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.env.Environment
import org.springframework.transaction.annotation.Transactional

@Transactional
class ObjectManagementImporter(
    private val objectManagementService: ObjectManagementService,
    private val objectManagementRepository: ObjectManagementRepository,
    private val objectMapper: ObjectMapper,
    private val environment: Environment
) : Importer {
    override fun type(): String = OBJECT_MANAGEMENT

    override fun dependsOn(): Set<String> = setOf(GLOBAL_FORM)

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition(): Boolean = false

    override fun partOfBuildingBlockDefinition(): Boolean = false

    override fun import(request: ImportRequest) {
        val objectManagementNode = objectMapper.readValue<ObjectNode>(request.content)
        val propertyValues = objectManagementNode.properties().map { it.key }.associateWith { key ->
            getEnvVariableOrYamlPropertyOrDirectValue(
                objectManagementNode[key].asText()
                    ?: objectManagementNode[key].asBoolean().toString()
            )
        }
        val objectManagement = objectMapper.readValue<ObjectManagement>(
            objectManagementNode.apply {
                propertyValues.forEach { (key, value) ->
                    put(key, value)
                }
            }.toString()
        )

        if (
            objectManagementRepository.findByObjecttypeId(objectManagement.objecttypeId) == null
            && objectManagementRepository.findByTitle(objectManagement.title) == null
        ) {
            objectManagementService.create(objectManagement)
        } else {
            objectManagementService.update(objectManagement)
        }
        logger.info { "Imported object management configuration ${objectManagement.title}" }
    }

    private fun getEnvVariableOrYamlPropertyOrDirectValue(value: String): String {
        return Regex("\\$\\{([^\\}]+)\\}").find(value)?.let { matchResult ->
            System.getenv(matchResult.groupValues[1])
                ?: System.getProperty(matchResult.groupValues[1])
                ?: environment.getProperty(matchResult.groupValues[1])
        } ?: value
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/global/object-management/(.+)\.object-management\.json""".toRegex()
    }
}
