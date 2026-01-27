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
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.importer.ValtimoImportService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
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
    private val objectMapper: ObjectMapper
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
                    val existingFinalIds = buildingBlockDefinitionRepository.findAll()
                        .filter { it.final }
                        .map { it.id }
                    valtimoImportService.importBuildingBlockDefinition(files, existingFinalIds)
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
        val resourceMap = resources.toMap()
        val allKeys = resources.map { it.first }.toSet()

        // Map resource keys to BuildingBlockDefinitionIds for matching
        val keyToDefinitionId = allKeys.associateWith { key ->
            // Key format: /definition-key/version-tag (e.g., /sub-processor/1-0-0)
            val parts = key.trim('/').split("/")
            BuildingBlockDefinitionId.of(parts[0], parts[1].replace("-", "."))
        }
        val definitionIdToKey = keyToDefinitionId.entries.associate { it.value to it.key }

        // Build dependency graph: resource key -> set of resource keys it depends on
        val dependencies = resources.associate { (key, files) ->
            val deps = files
                .filter { (filename, _) -> filename.endsWith(".process-link.json") }
                .flatMap { (_, resource) ->
                    try {
                        extractBuildingBlockDependencies(resource)
                            .mapNotNull { definitionIdToKey[it] }
                    } catch (_: Exception) {
                        logger.warn { "Failed to parse process link file for dependency analysis: ${resource.filename}" }
                        emptyList()
                    }
                }
                .toSet()
            key to deps
        }
        logger.info { "Building block dependencies: $dependencies" }

        // Topological sort using Kahn's algorithm
        // in-degree = number of unresolved dependencies for each building block
        val inDegree = allKeys.associateWith { key ->
            dependencies[key]?.size ?: 0
        }.toMutableMap()

        val sorted = mutableListOf<String>()
        val queue = ArrayDeque(inDegree.filterValues { it == 0 }.keys)

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            sorted.add(current)
            // Find all building blocks that depend on current and decrease their in-degree
            dependencies.forEach { (key, deps) ->
                if (current in deps) {
                    inDegree[key] = inDegree[key]!! - 1
                    if (inDegree[key] == 0) {
                        queue.add(key)
                    }
                }
            }
        }

        if (sorted.size != resources.size) {
            val remaining = allKeys - sorted.toSet()
            logger.warn { "Circular dependency detected among building blocks: $remaining. Importing in original order." }
            return resources
        }

        return sorted.mapNotNull { key -> resourceMap[key]?.let { key to it } }
    }

    /**
     * Extracts BuildingBlockDefinitionIds that this resource depends on.
     * Looks for building-block type process links and extracts their target definition IDs.
     */
    private fun extractBuildingBlockDependencies(resource: Resource): Set<BuildingBlockDefinitionId> {
        val content = resource.inputStream.bufferedReader().readText()
        val jsonTree = objectMapper.readTree(content)

        if (jsonTree !is ArrayNode) return emptySet()

        return jsonTree.mapNotNull { node ->
            if (node.get("processLinkType")?.asText() != "building-block") return@mapNotNull null

            val key = node.get("buildingBlockDefinitionKey")?.asText() ?: return@mapNotNull null
            val versionTag = node.get("buildingBlockDefinitionVersionTag")?.asText() ?: return@mapNotNull null

            BuildingBlockDefinitionId.of(key, versionTag)
        }.toSet()
    }

    companion object {
        private const val BUILDING_BLOCK_DEFINITION_PATH = "classpath*:config/building-block/*/*/**/*.*"
        private const val BUILDING_BLOCK_DEFINITION_FOLDER_STRUCTURE = "/config/building-block"

        val logger = KotlinLogging.logger {}
    }
}
