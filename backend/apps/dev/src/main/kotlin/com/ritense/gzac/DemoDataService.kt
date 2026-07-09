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
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.core.io.support.ResourcePatternUtils
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

/**
 * Seeds a handful of `verhuizing` cases on the *source* version (1.0.0) at startup, so they can be
 * migrated to 1.0.1 via the migration plans under `config/case/verhuizing/1-0-1/case-migration`.
 * Idempotent: only seeds when no `verhuizing` documents exist yet, and never fails startup.
 */
@Component
class DemoDataService(
    private val objectMapper: ObjectMapper,
    private val processDocumentService: ProcessDocumentService,
    private val resourceLoader: ResourceLoader,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
) {
    fun deployVerhuizingDocuments() {
        try {
            runWithoutAuthorization {
                val alreadySeeded = jsonSchemaDocumentRepository
                    .findCaseIdsByDocumentDefinitionName(DOCUMENT_DEFINITION_NAME, PageRequest.of(0, 1))
                    .hasContent()
                if (alreadySeeded) {
                    return@runWithoutAuthorization
                }

                getDocumentFileList().forEach { resource ->
                    try {
                        val content = resource.inputStream.bufferedReader().use { it.readText() }
                        val documentData = objectMapper.readValue<ObjectNode>(content)

                        val newDocumentRequest = NewDocumentRequest(
                            DOCUMENT_DEFINITION_NAME,
                            CASE_DEFINITION_KEY,
                            SOURCE_VERSION_TAG,
                            documentData,
                        )
                        processDocumentService.newDocumentAndStartProcess(
                            NewDocumentAndStartProcessRequest(PROCESS_DEFINITION_KEY, newDocumentRequest),
                        )
                    } catch (e: Exception) {
                        logger.warn(e) { "Failed to seed verhuizing document '${resource.filename}'" }
                    }
                }
                logger.info { "Seeded verhuizing demo cases on version $SOURCE_VERSION_TAG" }
            }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to seed verhuizing demo data" }
        }
    }

    private fun getDocumentFileList(): List<Resource> =
        ResourcePatternUtils
            .getResourcePatternResolver(resourceLoader)
            .getResources("classpath*:data/verhuizing/documents/*.json")
            .toList()

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val DOCUMENT_DEFINITION_NAME = "verhuizing"
        private const val CASE_DEFINITION_KEY = "verhuizing"
        private const val SOURCE_VERSION_TAG = "1.0.0"
        private const val PROCESS_DEFINITION_KEY = "verhuizing"
    }
}
