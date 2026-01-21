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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.importer.BuildingBlockDependencyResolver
import com.ritense.importer.ValtimoImportService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockImporterRan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.commons.lang3.StringUtils
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.FileNotFoundException

@Transactional
@Service
@SkipComponentScan
class BuildingBlockDefinitionDeploymentService(
    private val resourceLoader: ResourceLoader,
    private val valtimoImportService: ValtimoImportService,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val buildingBlockDependencyResolver: BuildingBlockDependencyResolver
) {
    @Order(Ordered.LOWEST_PRECEDENCE)
    @EventListener(ApplicationReadyEvent::class)
    fun deployOnStartup() {
        deployBuildingBlock()
        applicationEventPublisher.publishEvent(BuildingBlockImporterRan())
    }

    private fun deployBuildingBlock() {
        try {
            val resources =
                ResourcePatternUtils.getResourcePatternResolver(resourceLoader).getResources(BUILDING_BLOCK_DEFINITION_PATH)
                    .groupBy { resource ->
                        val relativePath = resource.url.path.substringAfter(BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE)
                        relativePath.substring(0, StringUtils.ordinalIndexOf(relativePath, "/", 3))
                    }
                    .map { (key, files) ->
                        key to (files.map {
                            it.url.path.substringAfter(BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE).substring(key.length) to it
                        })
                    }

            // Sort building blocks by dependencies (topological sort)
            val sortedResources = sortByDependencies(resources)

            logger.info { "Building block import order: ${sortedResources.map { it.first }}" }

            sortedResources.forEach { (key, files) ->
                logger.info { "Importing building block: $key" }
                runWithoutAuthorization {
                    valtimoImportService.importBuildingBlockDefinition(files, buildingBlockDefinitionRepository.findAll().map { it.id })
                }
            }

        } catch (_: FileNotFoundException) {
            // No resources found, nothing to import
            logger.info { "No building block definitions found. Continuing startup without importing building block definitions." }
        }
    }

    /**
     * Sorts building blocks by their dependencies using topological sort.
     * Building blocks that depend on other building blocks (via building-block process links)
     * will be imported after their dependencies.
     */
    private fun sortByDependencies(
        resources: List<Pair<String, List<Pair<String, Resource>>>>
    ): List<Pair<String, List<Pair<String, Resource>>>> {
        // Map resource keys to BuildingBlockDefinitionIds for matching
        val allKeys = resources.map { it.first }.toSet()
        val keyToDefinitionId = allKeys.associateWith { key ->
            // Key format: /definition-key/version-tag (e.g., /sub-processor/1-0-0)
            buildingBlockDependencyResolver.fromFolderPath(key)
        }
        val definitionIdToKey = keyToDefinitionId.entries.associate { it.value to it.key }

        return buildingBlockDependencyResolver.sortByDependencies(
            items = resources,
            keyExtractor = { it.first },
            dependencyExtractor = { (_, files) ->
                files
                    .filter { (filename, _) -> filename.endsWith(".process-link.json") }
                    .flatMap { (_, resource) ->
                        try {
                            val content = resource.inputStream.use { it.readBytes() }
                            buildingBlockDependencyResolver.extractDependenciesFromProcessLink(content)
                                .mapNotNull { definitionIdToKey[it] }
                        } catch (_: Exception) {
                            logger.warn { "Failed to parse process link file for dependency analysis: ${resource.filename}" }
                            emptyList()
                        }
                    }
                    .toSet()
            }
        )
    }

    companion object {
        private const val BUILDING_BLOCK_DEFINITION_PATH = "classpath*:config/building-block/*/*/**/*.*"
        private const val BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE = "/config/building-block"

        val logger = KotlinLogging.logger {}
    }
}