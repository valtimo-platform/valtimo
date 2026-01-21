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

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportContext.Companion.runImporter
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import com.ritense.importer.exception.CyclicImporterDependencyException
import com.ritense.importer.exception.DuplicateImporterTypeException
import com.ritense.importer.exception.InvalidImportZipException
import com.ritense.importer.exception.TooManyImportCandidatesException
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.apache.commons.lang3.StringUtils
import org.springframework.core.env.Environment
import org.springframework.core.io.Resource
import org.springframework.transaction.annotation.Transactional
import java.io.InputStream
import java.util.zip.ZipInputStream

@AllOpen
class ValtimoImportService(
    importers: Set<Importer>,
    private val environment: Environment,
    val whitelistedEnvironmentProperties: List<Regex>,
    private val buildingBlockDependencyResolver: BuildingBlockDependencyResolver
) : ImportService {

    private val orderedImporters = distinctImporters(importers).let {
        filterImportersByDependsOn(it)
    }.let {
        orderImporters(it)
    }

    /**
     * Get a distinct set of importers by type.
     * Fails when duplicates are found.
     */
    private fun distinctImporters(importers: Set<Importer>): Set<Importer> {
        return importers.map { WrappedImporter(it) }
            .toSet()
            .apply {
                if (this.size != importers.size) {
                    val duplicatedTypes = this.filter { wImporter ->
                        importers.count { wImporter.type() == it.type() } > 1
                    }.map { it.type() }.toSet()
                    throw DuplicateImporterTypeException(duplicatedTypes)
                }
            }
    }

    /**
     * This will filter out any importer that depends on an importer that is not provided.
     */
    private fun filterImportersByDependsOn(importers: Set<Importer>): Set<Importer> {
        var result = importers

        while (result.isNotEmpty()) {
            //Filter out importers of which any of the dependencies cannot be resolved
            val filtered = result.filter { importer ->
                importer.dependsOn().all { type ->
                    result.any { it.type() == type }
                        .also { dependencyFound ->
                            if (!dependencyFound) {
                                logger.warn { "Importer ${importer.type()} depends on '$type', which cannot be resolved. Importer will not be used!" }
                            }
                        }
                }
            }.toSet()

            // Check if any importer was filtered. If not, we can stop the loop
            if (filtered.size == result.size) {
                break
            }

            result = filtered
        }

        return result
    }

    /**
     * Order the imports by their dependencies.
     * Fail when the dependencies form a circular dependency
     */
    private fun orderImporters(importers: Set<Importer>): LinkedHashSet<Importer> {
        val orderedImporters = LinkedHashMap<String, Importer>()
        while (orderedImporters.size < importers.size) {
            importers.filter {
                !orderedImporters.containsKey(it.type())
                    && orderedImporters.keys.containsAll(it.dependsOn())
            }.apply {
                if (this.isEmpty()) {
                    throw CyclicImporterDependencyException(orderedImporters.keys)
                }
            }.forEach {
                orderedImporters[it.type()] = it
            }
        }
        return linkedSetOf(*orderedImporters.values.toTypedArray())
    }

    @Transactional
    fun importCaseDefinition(
        resources: List<Pair<String, Resource>>,
        caseDefinitionIdList: List<CaseDefinitionId>
    ) {
        runImporter {
            // If case definition is already imported, don't import the rest of the files for the case definition
            // (so a skip)

            val importerEntriesList = getEntriesByImporter(
                getEntriesFromResources(resources),
                { importer -> importer.partOfCaseDefinition() }
            )
            val caseDefinitionId: CaseDefinitionId?
            val caseDefinitionEntries = importerEntriesList
                .filter { it.key.type() == CASE_DEFINITION }
                .let {
                    it[it.keys.first()]
                }
            val caseDefinitionContent = caseDefinitionEntries?.firstOrNull()?.content
                ?: throw IllegalStateException("No case definition file found in the provided resources")
            val caseDefinitionMap: Map<String, Any> = jacksonObjectMapper()
                .readValue(caseDefinitionContent)
            caseDefinitionId = CaseDefinitionId(
                caseDefinitionMap["key"] as String,
                caseDefinitionMap["versionTag"] as String
            )

            if (caseDefinitionIdList.contains(caseDefinitionId)) {
                return@runImporter
            }

            importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                    importer.import(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                }
            }

            importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                }
            }
        }

    }

    @Transactional
    open fun importBuildingBlockDefinition(
        resources: List<Pair<String, Resource>>,
        buildingBlockDefinitionIdList: List<BuildingBlockDefinitionId>
    ) {
        runImporter {
            // If building block definition is already imported, don't import the rest of the files for the building
            // block definition (so a skip)

            val importerEntriesList = getEntriesByImporter(
                getEntriesFromResources(resources),
                { importer -> importer.partOfBuildingBlockDefinition() }
            )
            val buildingBlockDefinitionId: BuildingBlockDefinitionId?
            val buildingBlockDefinitionEntries = importerEntriesList
                .filter { it.key.type() == BUILDING_BLOCK_DEFINITION }
                .let {
                    it[it.keys.first()]
                }
            val definitionContent = buildingBlockDefinitionEntries?.firstOrNull()?.content
                ?: throw IllegalStateException("No building block definition file found in the provided resources")
            val buildingBlockDefinitionMap: Map<String, Any> = jacksonObjectMapper()
                .readValue(definitionContent)
            buildingBlockDefinitionId = BuildingBlockDefinitionId(
                buildingBlockDefinitionMap["key"] as String,
                buildingBlockDefinitionMap["versionTag"] as String
            )

            if (buildingBlockDefinitionIdList.contains(buildingBlockDefinitionId)) {
                return@runImporter
            }

            importerEntriesList.filter { it.key.partOfBuildingBlockDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                    importer.import(ImportRequest(entry.fileName, entry.content, null, buildingBlockDefinitionId))
                }
            }

            importerEntriesList.filter { it.key.partOfBuildingBlockDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content, null, buildingBlockDefinitionId))
                }
            }
        }

    }

    @Transactional
    fun importGlobalDefinitions(
        resources: List<Pair<String, Resource>>
    ) {
        runImporter {
            val importerEntriesList = getEntriesByImporter(
                getEntriesFromResources(resources),
                { importer -> !importer.partOfCaseDefinition() && !importer.partOfBuildingBlockDefinition() }
            )

            importerEntriesList.filter { !it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                    importer.import(ImportRequest(entry.fileName, entry.content))
                }
            }
            importerEntriesList.filter { !it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content))
                }
            }
        }

    }

    @Transactional
    override fun importGlobal(inputStream: InputStream) {
        runImporter {
            val entries = readZipEntries(inputStream)
            val importerEntriesList = getEntriesByImporter(
                entries,
                { importer -> !importer.partOfCaseDefinition() && !importer.partOfBuildingBlockDefinition() }
            ).ifEmpty { return@runImporter }

            importerEntriesList.filter { !it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                    importer.import(ImportRequest(entry.fileName, entry.content))
                }
            }
            importerEntriesList.filter { !it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content))
                }
            }
        }
    }

    @Transactional
    override fun import(inputStream: InputStream, caseDefinitionIdList: List<CaseDefinitionId>): CaseDefinitionId? {
        return runImporter {
            val entries = readZipEntries(inputStream)
            val importerEntriesList = getEntriesByImporter(
                entries
            ) { importer -> importer.partOfCaseDefinition() }
                .ifEmpty { return@runImporter null }
            val caseDefinitionId: CaseDefinitionId?
            val filteredImporterEntriesList = importerEntriesList
                .filter { it.key.type() == CASE_DEFINITION }

            if (filteredImporterEntriesList.isNotEmpty()) {
                val caseDefinitionEntries = filteredImporterEntriesList.let {
                    it[it.keys.first()]
                }
                val caseDefinitionMap: Map<String, Any> = jacksonObjectMapper()
                    .readValue(caseDefinitionEntries?.first()?.content!!) // TODO: Throw proper error message
                caseDefinitionId = CaseDefinitionId(
                    caseDefinitionMap["key"] as String,
                    caseDefinitionMap["versionTag"] as String
                )

                if (caseDefinitionIdList.contains(caseDefinitionId)) {
                    return@runImporter caseDefinitionId
                }

                importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                    entries.forEach { entry ->
                        logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                        importer.import(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                    }
                }

            } else {
                caseDefinitionId = null
            }

            importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                }
            }

            return@runImporter caseDefinitionId
        }
    }

    @Transactional
    override fun importBuildingBlockDefinitions(
        inputStream: InputStream,
        buildingBlockDefinitionIdList: List<BuildingBlockDefinitionId>
    ) {
        runImporter {
            val entries = readZipEntries(inputStream)

            val importerEntriesList = getEntriesByImporter(
                entries
            ) { importer -> importer.partOfBuildingBlockDefinition() }
                .ifEmpty { return@runImporter }

            val filteredImporterEntriesList = importerEntriesList
                .filter { it.key.type() == BUILDING_BLOCK_DEFINITION }

            if (filteredImporterEntriesList.isEmpty()) {
                throw IllegalStateException("No building block definition file found in the provided archive")
            }

            val definitionEntries = filteredImporterEntriesList.let { it[it.keys.first()] }
            val definitionMap: Map<String, Any> = jacksonObjectMapper()
                .readValue(definitionEntries?.first()?.content!!)
            val buildingBlockDefinitionId = BuildingBlockDefinitionId(
                definitionMap["key"] as String,
                definitionMap["versionTag"] as String
            )

            if (buildingBlockDefinitionIdList.contains(buildingBlockDefinitionId)) {
                return@runImporter
            }

            importerEntriesList
                .filter { it.key.partOfBuildingBlockDefinition() }
                .forEach { (importer, bbEntries) ->
                    bbEntries.forEach { entry ->
                        logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                        importer.import(
                            ImportRequest(
                                entry.fileName,
                                entry.content,
                                null,
                                buildingBlockDefinitionId
                            )
                        )
                    }
                }

            importerEntriesList
                .filter { it.key.partOfBuildingBlockDefinition() }
                .forEach { (importer, bbEntries) ->
                    bbEntries.forEach { entry ->
                        importer.afterImport(
                            ImportRequest(
                                entry.fileName,
                                entry.content,
                                null,
                                buildingBlockDefinitionId
                            )
                        )
                    }
                }
        }
    }

    @Transactional
    override fun importCaseWithDependencies(
        inputStream: InputStream,
        existingCaseDefinitions: List<CaseDefinitionId>,
        existingBuildingBlocks: List<BuildingBlockDefinitionId>
    ): CaseDefinitionId? {
        return runImporter {
            // Read all entries keeping original paths for building block grouping
            val rawEntries = readZipEntriesWithOriginalPaths(inputStream)

            // Import building blocks first (dependencies should be imported before the case)
            importBuildingBlocksFromRawEntries(rawEntries, existingBuildingBlocks)

            // Prepare entries for case import (strip prefixes)
            val caseEntries = rawEntries
                .filter { it.originalPath.startsWith("config/case") }
                .map { ZipFileEntry(prepareFilePath(it.originalPath), it.content) }

            if (caseEntries.isEmpty()) {
                return@runImporter null
            }

            // Import case definition using existing logic
            val importerEntriesList = getEntriesByImporter(caseEntries) { importer ->
                importer.partOfCaseDefinition()
            }.ifEmpty { return@runImporter null }

            val caseDefinitionId: CaseDefinitionId?
            val filteredImporterEntriesList = importerEntriesList
                .filter { it.key.type() == CASE_DEFINITION }

            if (filteredImporterEntriesList.isNotEmpty()) {
                val caseDefinitionEntries = filteredImporterEntriesList.let {
                    it[it.keys.first()]
                }
                val caseDefinitionMap: Map<String, Any> = jacksonObjectMapper()
                    .readValue(caseDefinitionEntries?.first()?.content!!)
                caseDefinitionId = CaseDefinitionId(
                    caseDefinitionMap["key"] as String,
                    caseDefinitionMap["versionTag"] as String
                )

                if (existingCaseDefinitions.contains(caseDefinitionId)) {
                    return@runImporter caseDefinitionId
                }

                importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                    entries.forEach { entry ->
                        logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                        importer.import(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                    }
                }

            } else {
                caseDefinitionId = null
            }

            importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(entry.fileName, entry.content, caseDefinitionId))
                }
            }

            return@runImporter caseDefinitionId
        }
    }

    /**
     * Groups building block entries by their definition ID and imports them in order.
     * Skips building blocks that already exist.
     */
    private fun importBuildingBlocksFromRawEntries(
        rawEntries: List<RawZipFileEntry>,
        existingBuildingBlocks: List<BuildingBlockDefinitionId>
    ) {
        // Group entries by building block (key/version)
        val buildingBlockGroups = rawEntries
            .filter { it.originalPath.startsWith("config/building-block/") }
            .groupBy { entry ->
                // Extract key/version from path like config/building-block/key/1-0-0/...
                val pathParts = entry.originalPath.removePrefix("config/building-block/").split("/")
                if (pathParts.size >= 2) {
                    "${pathParts[0]}/${pathParts[1]}"
                } else {
                    null
                }
            }
            .filterKeys { it != null }
            .mapKeys { it.key!! }

        if (buildingBlockGroups.isEmpty()) {
            return
        }

        // Sort building blocks by dependencies using the shared utility
        val sortedGroups = buildingBlockDependencyResolver.sortByDependencies(
            items = buildingBlockGroups.entries.toList(),
            keyExtractor = { it.key },
            dependencyExtractor = { (_, entries) ->
                entries
                    .filter { it.originalPath.endsWith(".process-link.json") }
                    .flatMap { entry ->
                        buildingBlockDependencyResolver.extractDependenciesFromProcessLink(entry.content)
                            .map { buildingBlockDependencyResolver.toFolderPath(it) }
                    }
                    .toSet()
            }
        )

        logger.info { "Importing building blocks in order: ${sortedGroups.map { it.key }}" }

        // Import each building block
        sortedGroups.forEach { (bbKey, bbRawEntries) ->
            // Prepare entries (strip prefix for importers)
            val bbEntries = bbRawEntries.map { raw ->
                ZipFileEntry(prepareFilePath(raw.originalPath), raw.content)
            }

            val importerEntriesList = getEntriesByImporter(bbEntries) { importer ->
                importer.partOfBuildingBlockDefinition()
            }

            if (importerEntriesList.isEmpty()) {
                return@forEach
            }

            // Extract building block definition ID
            val definitionEntries = importerEntriesList
                .filter { it.key.type() == BUILDING_BLOCK_DEFINITION }
                .let { it[it.keys.firstOrNull()] }

            if (definitionEntries.isNullOrEmpty()) {
                logger.warn { "No building block definition file found for $bbKey, skipping" }
                return@forEach
            }

            val definitionMap: Map<String, Any> = jacksonObjectMapper()
                .readValue(definitionEntries.first().content)
            val buildingBlockDefinitionId = BuildingBlockDefinitionId(
                definitionMap["key"] as String,
                definitionMap["versionTag"] as String
            )

            // Skip if already exists
            if (existingBuildingBlocks.contains(buildingBlockDefinitionId)) {
                logger.debug { "Skipping existing building block: $buildingBlockDefinitionId" }
                return@forEach
            }

            logger.info { "Importing building block: $buildingBlockDefinitionId" }

            // Import
            importerEntriesList
                .filter { it.key.partOfBuildingBlockDefinition() }
                .forEach { (importer, entries) ->
                    entries.forEach { entry ->
                        logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                        importer.import(
                            ImportRequest(entry.fileName, entry.content, null, buildingBlockDefinitionId)
                        )
                    }
                }

            // After import
            importerEntriesList
                .filter { it.key.partOfBuildingBlockDefinition() }
                .forEach { (importer, entries) ->
                    entries.forEach { entry ->
                        importer.afterImport(
                            ImportRequest(entry.fileName, entry.content, null, buildingBlockDefinitionId)
                        )
                    }
                }
        }
    }

    /**
     * Reads zip entries keeping original paths for building block grouping.
     */
    private fun readZipEntriesWithOriginalPaths(inputStream: InputStream): List<RawZipFileEntry> {
        return try {
            ZipInputStream(inputStream).use { stream ->
                generateSequence { stream.nextEntry }
                    .filter { !it.isDirectory }
                    .map { RawZipFileEntry(it.name, stream.readBytes()) }
                    .toMutableList()
            }
        } catch (ex: Exception) {
            throw InvalidImportZipException(ex.message)
        }.apply {
            if (this.isEmpty()) {
                throw InvalidImportZipException("Archive was empty or not a zip")
            }
        }
    }

    private fun readZipEntries(inputStream: InputStream): List<ZipFileEntry> {
        // Read all entries with data from the stream
        return try {
            ZipInputStream(inputStream).use { stream ->
                generateSequence { stream.nextEntry }
                    .filter { !it.isDirectory }
                    .map { ZipFileEntry(prepareFilePath(it.name), stream.readBytes()) }
                    .toMutableList()
            }
        } catch (ex: Exception) {
            throw InvalidImportZipException(ex.message)
        }.apply {
            if (this.isEmpty()) {
                throw InvalidImportZipException("Archive was empty or not a zip")
            }
        }
    }

    private fun prepareFilePath(path: String): String {
        return if (path.startsWith("config/case")) {
            val relativePath = path.substringAfter("config/case")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                path
            }
        } else if (path.startsWith("config/building-block")) {
            val relativePath = path.substringAfter("config/building-block")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                path
            }
        } else if (path.startsWith("config/global")) {
            return path.substringAfter("config")
        } else {
            path
        }
    }

    private fun getEntriesFromResources(resources: List<Pair<String, Resource>>): List<ZipFileEntry> {
        return resources.map { (path, resource) ->
            val bytes =
                if (isTextResource(path)) {
                    val resolvedContent = resolveProperties(resource.getContentAsString(Charsets.UTF_8))
                    resolvedContent.toByteArray(Charsets.UTF_8)
                } else {
                    resource.inputStream.use { it.readBytes() }
                }

            ZipFileEntry(path, bytes)
        }
    }

    private fun isTextResource(path: String): Boolean {
        return path.endsWith(".json", ignoreCase = true) ||
            path.endsWith(".yml", ignoreCase = true) ||
            path.endsWith(".yaml", ignoreCase = true) ||
            path.endsWith(".xml", ignoreCase = true) ||
            path.endsWith(".sql", ignoreCase = true) ||
            path.endsWith(".txt", ignoreCase = true)
    }

    private fun resolveProperties(content: String): String {
        var resolvedContent = content
        Regex("\\$\\{([^\\}]+)\\}").findAll(content)
            .map { it.groupValues }
            .forEach { (placeholder, placeholderValue) ->
                try {
                    whitelistedEnvironmentProperties.firstOrNull { it.matches(placeholderValue) }?.let {
                        val resolvedValue = environment.getProperty(placeholderValue)
                        if (!resolvedValue.isNullOrBlank()) {
                            resolvedContent = resolvedContent.replace(placeholder, resolvedValue)
                        }
                    }
                } catch (e: Exception) {
                    // ignored
                }
            }
        return resolvedContent
    }

    // change entries to be nested
    /**
     * Maps all entries by a supporting importer.
     * When no files are provided, an empty list value is mapped.
     * @param entries
     */
    private fun getEntriesByImporter(
        entries: List<ZipFileEntry>,
        filter: (Importer) -> Boolean
    ): LinkedHashMap<Importer, List<ZipFileEntry>> {
        val entryPairs = entries.mapNotNull { entry ->
            orderedImporters.filter(filter).filter { importer ->
                importer.supports(entry.fileName)
            }.apply {
                if (this.isEmpty()) {
                    logger.info { "No importer candidate found for file ${entry.fileName}." }
                } else if (this.size > 1) {
                    throw TooManyImportCandidatesException(
                        entry.fileName,
                        this.map { it.type() }.toSet()
                    )
                }
            }.firstOrNull()?.let {
                Pair(it, entry)
            }
        }

        // The map keys are kept in the same order as `importers` by using a LinkedHashMap
        return orderedImporters.associateWithTo(LinkedHashMap()) { importer ->
            entryPairs.filter {
                it.first == importer
            }.map {
                it.second
            }
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}

        class WrappedImporter(

            private val importer: Importer
        ) : Importer by importer {

            override fun equals(other: Any?): Boolean {
                if (this === other) return true
                if (javaClass != other?.javaClass) return false

                other as Importer

                return importer.type() == other.type()
            }

            override fun hashCode(): Int {
                return importer.type().hashCode()
            }
        }

        data class ZipFileEntry(
            val fileName: String,
            val content: ByteArray
        ) {

            override fun equals(other: Any?): Boolean {
                if (this === other) return true
                if (javaClass != other?.javaClass) return false

                other as ZipFileEntry

                return fileName == other.fileName
            }

            override fun hashCode(): Int {
                return fileName.hashCode()
            }
        }

        /**
         * Zip file entry with original path preserved for grouping.
         */
        data class RawZipFileEntry(
            val originalPath: String,
            val content: ByteArray
        ) {

            override fun equals(other: Any?): Boolean {
                if (this === other) return true
                if (javaClass != other?.javaClass) return false

                other as RawZipFileEntry

                return originalPath == other.originalPath
            }

            override fun hashCode(): Int {
                return originalPath.hashCode()
            }
        }
    }
}
