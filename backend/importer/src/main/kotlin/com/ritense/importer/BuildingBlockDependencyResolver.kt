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

package com.ritense.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging

/**
 * Utility for resolving building block dependencies and performing topological sorting.
 * Used during import and deployment to ensure building blocks are processed in dependency order.
 */
class BuildingBlockDependencyResolver(
    private val objectMapper: ObjectMapper
) {

    /**
     * Sorts items by their building block dependencies using topological sort (Kahn's algorithm).
     * Items that depend on other building blocks will come after their dependencies.
     *
     * @param T The type of items being sorted
     * @param items The items to sort
     * @param keyExtractor Function to extract the unique key for each item
     * @param dependencyExtractor Function to extract the set of keys this item depends on
     * @return Items sorted in dependency order, or original order if circular dependency detected
     */
    fun <T> sortByDependencies(
        items: List<T>,
        keyExtractor: (T) -> String,
        dependencyExtractor: (T) -> Set<String>
    ): List<T> {
        val itemMap = items.associateBy(keyExtractor)
        val allKeys = items.map(keyExtractor).toSet()

        // Build dependency graph, filtering to only include dependencies that exist in our item set
        val dependencies = items.associate { item ->
            val key = keyExtractor(item)
            val deps = dependencyExtractor(item).filter { it in allKeys }.toSet()
            key to deps
        }

        logger.debug { "Building block dependencies: $dependencies" }

        // Topological sort using Kahn's algorithm
        val inDegree = allKeys.associateWith { key ->
            dependencies[key]?.size ?: 0
        }.toMutableMap()

        val sorted = mutableListOf<String>()
        val queue = ArrayDeque(inDegree.filterValues { it == 0 }.keys)

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            sorted.add(current)
            dependencies.forEach { (key, deps) ->
                if (current in deps) {
                    inDegree[key] = inDegree[key]!! - 1
                    if (inDegree[key] == 0) {
                        queue.add(key)
                    }
                }
            }
        }

        if (sorted.size != items.size) {
            val remaining = allKeys - sorted.toSet()
            logger.warn { "Circular dependency detected among building blocks: $remaining. Using original order." }
            return items
        }

        return sorted.mapNotNull { key -> itemMap[key] }
    }

    /**
     * Extracts BuildingBlockDefinitionIds that a process-link JSON content depends on.
     * Looks for building-block type process links and extracts their target definition IDs.
     *
     * @param content The process-link JSON content as bytes
     * @return Set of BuildingBlockDefinitionIds this content depends on
     */
    fun extractDependenciesFromProcessLink(content: ByteArray): Set<BuildingBlockDefinitionId> {
        return try {
            val jsonTree = objectMapper.readTree(content)
            if (jsonTree !is ArrayNode) return emptySet()

            jsonTree.mapNotNull { node ->
                if (node.get("processLinkType")?.asText() != "building-block") return@mapNotNull null

                val key = node.get("buildingBlockDefinitionKey")?.asText() ?: return@mapNotNull null
                val versionTag = node.get("buildingBlockDefinitionVersionTag")?.asText() ?: return@mapNotNull null

                BuildingBlockDefinitionId.of(key, versionTag)
            }.toSet()
        } catch (e: Exception) {
            logger.warn(e) { "Failed to parse process link for dependency extraction" }
            emptySet()
        }
    }

    /**
     * Converts a BuildingBlockDefinitionId to the folder path format used in config directories.
     * E.g., BuildingBlockDefinitionId("my-block", "1.0.0") -> "my-block/1-0-0"
     */
    fun toFolderPath(id: BuildingBlockDefinitionId): String {
        val versionFolder = "${id.versionTag.major}-${id.versionTag.minor}-${id.versionTag.patch}"
        return "${id.key}/$versionFolder"
    }

    /**
     * Parses a folder path back to a BuildingBlockDefinitionId.
     * E.g., "my-block/1-0-0" -> BuildingBlockDefinitionId("my-block", "1.0.0")
     */
    fun fromFolderPath(path: String): BuildingBlockDefinitionId {
        val trimmedPath = path.trim('/')
        val parts = trimmedPath.split("/")
        require(parts.size >= 2) { "Invalid building block folder path: $path" }
        return BuildingBlockDefinitionId.of(parts[0], parts[1].replace("-", "."))
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
