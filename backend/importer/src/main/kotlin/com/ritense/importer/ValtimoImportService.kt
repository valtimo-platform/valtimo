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
    private val buildingBlockDefinitionIdSupplier: BuildingBlockDefinitionIdSupplier? = null
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
    open fun importBuildingBlockDefinitionsWithStream(
        resources: List<Pair<String, Resource>>,
        buildingBlockDefinitionIdList: List<BuildingBlockDefinitionId>
    ) {
        importBuildingBlockDefinition(getEntriesFromResources(resources), buildingBlockDefinitionIdList)

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
        return import(inputStream, caseDefinitionIdList, null, null)
    }

    @Transactional
    override fun import(
        inputStream: InputStream,
        caseDefinitionIdList: List<CaseDefinitionId>,
        keyOverride: String?,
        nameOverride: String?,
    ): CaseDefinitionId? {
        return runImporter {
            val entriesWithRawPath = readZipEntriesWithRawPath(inputStream)
            val buildingBlockEntries = groupBuildingBlockEntries(entriesWithRawPath)

            val existingBuildingBlockIds = buildingBlockDefinitionIdSupplier?.getIds().orEmpty()
            buildingBlockEntries.values.forEach { entries ->
                importBuildingBlockDefinition(entries, existingBuildingBlockIds)
            }

            val entries = entriesWithRawPath
                .filter { extractBuildingBlockGroupKey(it.first) == null }
                .map { it.second }

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
                    keyOverride ?: (caseDefinitionMap["key"] as String),
                    caseDefinitionMap["versionTag"] as String
                )

                if (caseDefinitionIdList.contains(caseDefinitionId)) {
                    return@runImporter caseDefinitionId
                }

                importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                    entries.forEach { entry ->
                        logger.debug { "Importing ${entry.fileName} with importer ${importer.type()}" }
                        importer.import(ImportRequest(
                            entry.fileName, entry.content, caseDefinitionId,
                            keyOverride = keyOverride,
                            nameOverride = nameOverride,
                        ))
                    }
                }

            } else {
                caseDefinitionId = null
            }

            importerEntriesList.filter { it.key.partOfCaseDefinition() }.forEach { (importer, entries) ->
                entries.forEach { entry ->
                    importer.afterImport(ImportRequest(
                        entry.fileName, entry.content, caseDefinitionId,
                        keyOverride = keyOverride,
                        nameOverride = nameOverride,
                    ))
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
        val entriesWithRawPath = readZipEntriesWithRawPath(inputStream)
        val buildingBlockEntries = groupBuildingBlockEntries(entriesWithRawPath)

        if (buildingBlockEntries.isEmpty()) {
            throw IllegalStateException("No building block definition file found in the provided archive")
        }

        buildingBlockEntries.values.forEach { entries ->
            importBuildingBlockDefinition(entries, buildingBlockDefinitionIdList)
        }
    }

    @Transactional
    override fun importBuildingBlockDefinition(
        entries: List<ZipFileEntry>,
        buildingBlockDefinitionIdList: List<BuildingBlockDefinitionId>
    ) {
        runImporter {
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

    private fun readZipEntries(inputStream: InputStream): List<ZipFileEntry> {
        return readZipEntriesWithRawPath(inputStream).map { it.second }
    }

    private fun readZipEntriesWithRawPath(inputStream: InputStream): List<Pair<String, ZipFileEntry>> {
        // Read all entries with data from the stream
        return try {
            ZipInputStream(inputStream).use { stream ->
                generateSequence { stream.nextEntry }
                    .filter { !it.isDirectory }
                    .map { entry ->
                        val content = stream.readBytes()
                        val preparedPath = prepareFilePath(entry.name)
                        entry.name to ZipFileEntry(preparedPath, content)
                    }
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
        val normalizedPath = path.trimStart('/')
        return if (normalizedPath.startsWith("config/case")) {
            val relativePath = normalizedPath.substringAfter("config/case")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                normalizedPath
            }
        } else if (normalizedPath.startsWith("case/")) {
            val relativePath = normalizedPath.substringAfter("case")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                normalizedPath
            }
        } else if (normalizedPath.startsWith("config/building-block")) {
            val relativePath = normalizedPath.substringAfter("config/building-block")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                normalizedPath
            }
        } else if (normalizedPath.startsWith("building-block")) {
            val relativePath = normalizedPath.substringAfter("building-block")
            val subStringStartIndex = StringUtils.ordinalIndexOf(relativePath, "/", 3)
            if (subStringStartIndex > -1) {
                relativePath.substring(subStringStartIndex)
            } else {
                normalizedPath
            }
        } else if (normalizedPath.startsWith("config/global")) {
            return normalizedPath.substringAfter("config")
        } else {
            normalizedPath
        }
    }

    private fun groupBuildingBlockEntries(
        entriesWithRawPath: List<Pair<String, ZipFileEntry>>
    ): Map<String, List<ZipFileEntry>> {
        val grouped = LinkedHashMap<String, MutableList<ZipFileEntry>>()

        entriesWithRawPath.forEach { (rawPath, entry) ->
            val groupKey = extractBuildingBlockGroupKey(rawPath) ?: return@forEach
            grouped.getOrPut(groupKey) { mutableListOf() }.add(entry)
        }

        val result = LinkedHashMap<String, List<ZipFileEntry>>()
        grouped.forEach { (key, entries) ->
            result[key] = entries.toList()
        }
        return result
    }

    private fun extractBuildingBlockGroupKey(rawPath: String): String? {
        val normalizedPath = rawPath.trimStart('/')
        val basePath = when {
            normalizedPath.startsWith("config/building-block/") -> "config/building-block/"
            normalizedPath.startsWith("building-block/") -> "building-block/"
            else -> return null
        }

        val relativePath = normalizedPath.substringAfter(basePath)
        val subStringEndIndex = StringUtils.ordinalIndexOf(relativePath, "/", 2)
        if (subStringEndIndex < 0) {
            return null
        }

        val groupPath = relativePath.substring(0, subStringEndIndex)
        return "building-block/$groupPath"
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

    }
}
