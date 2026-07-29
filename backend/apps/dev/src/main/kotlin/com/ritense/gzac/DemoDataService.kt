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

package com.ritense.gzac

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.repository.impl.specification.JsonSchemaDocumentSpecificationHelper.Companion.byDocumentDefinitionIdCaseDefinitionId
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.stereotype.Component

/**
 * Generic dev-only seeder for demo cases. Everything is derived from the folder layout, mirroring
 * the `resources/config/` convention (e.g. `config/building-block/verhuizing-inspectie/1-0-1/bpmn`):
 *
 * ```
 * data/<caseKey>/<version>/documents/<name>.json
 * ```
 *
 * - `<caseKey>` — used as the case definition key, process definition key and document definition
 *   name (matching the shipped case definitions, where all three are identical).
 * - `<version>` — the case definition version to seed the documents on, written dash-separated like
 *   the config folders (`1-0-0` becomes version tag `1.0.0`). A document can be created directly on
 *   any deployed version, so every version folder is seeded independently.
 *
 * Adding a new demo case or version therefore requires no code change — just drop in a folder.
 *
 * Idempotent per case version: only seeds a `<caseKey>/<version>` when no document exists yet for
 * that exact case definition version, and never fails startup.
 */
@Component
class DemoDataService(
    private val objectMapper: ObjectMapper,
    private val processDocumentService: ProcessDocumentService,
    private val resourceLoader: ResourceLoader,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
) {
    /** Discovers and seeds every demo case folder under `data/`. Invoked once at startup. */
    fun deployDemoData() {
        discoverDemoCases().forEach { seedCase(it) }
    }

    /** Groups every demo document resource by the case it belongs to, deriving key and version from the path. */
    private fun discoverDemoCases(): List<DemoCase> =
        ResourcePatternUtils
            .getResourcePatternResolver(resourceLoader)
            .getResources("classpath*:data/*/*/documents/*.json")
            .mapNotNull { resource -> demoCaseKeyOf(resource)?.let { it to resource } }
            .groupBy({ it.first }, { it.second })
            .map { (key, documents) -> DemoCase(key.caseKey, key.versionTag, documents) }

    private fun seedCase(demoCase: DemoCase) {
        try {
            runWithoutAuthorization {
                val caseDefinitionId = CaseDefinitionId.of(demoCase.caseKey, demoCase.versionTag)
                val alreadySeeded = jsonSchemaDocumentRepository
                    .count(byDocumentDefinitionIdCaseDefinitionId(caseDefinitionId)) > 0
                if (alreadySeeded) {
                    return@runWithoutAuthorization
                }

                demoCase.documents.forEach { resource ->
                    try {
                        val content = resource.inputStream.bufferedReader().use { it.readText() }
                        val documentData = objectMapper.readValue<ObjectNode>(content)

                        val newDocumentRequest = NewDocumentRequest(
                            demoCase.caseKey,
                            demoCase.caseKey,
                            demoCase.versionTag,
                            documentData,
                        )
                        processDocumentService.newDocumentAndStartProcess(
                            NewDocumentAndStartProcessRequest(demoCase.caseKey, newDocumentRequest),
                        )
                    } catch (e: Exception) {
                        logger.warn(e) { "Failed to seed ${demoCase.caseKey} ${demoCase.versionTag} document '${resource.filename}'" }
                    }
                }
                logger.info { "Seeded ${demoCase.documents.size} ${demoCase.caseKey} demo cases on version ${demoCase.versionTag}" }
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to seed ${demoCase.caseKey} ${demoCase.versionTag} demo data" }
        }
    }

    /**
     * Extracts the case key and version from a `.../data/<caseKey>/<version>/documents/<file>.json`
     * resource URI, converting the dash-separated version folder to a dotted version tag.
     */
    private fun demoCaseKeyOf(resource: Resource): DemoCaseKey? =
        DATA_FOLDER_REGEX.find(resource.uri.toString())?.let { match ->
            val (caseKey, versionFolder) = match.destructured
            DemoCaseKey(caseKey, versionFolder.replace('-', '.'))
        }

    private data class DemoCaseKey(
        val caseKey: String,
        val versionTag: String,
    )

    private data class DemoCase(
        val caseKey: String,
        val versionTag: String,
        val documents: List<Resource>,
    )

    companion object {
        private val logger = KotlinLogging.logger {}
        private val DATA_FOLDER_REGEX = Regex("""/data/([^/]+)/([^/]+)/documents/""")
    }
}
