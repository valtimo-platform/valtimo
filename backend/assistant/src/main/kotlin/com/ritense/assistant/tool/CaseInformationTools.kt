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

package com.ritense.assistant.tool

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import dev.langchain4j.agent.tool.P
import dev.langchain4j.agent.tool.Tool
import org.springframework.data.domain.Pageable
import org.springframework.security.access.AccessDeniedException
import java.util.UUID

open class CaseInformationTools(
    private val documentService: DocumentService,
    private val caseTabService: CaseTabService,
    private val caseWidgetService: CaseWidgetService,
    private val caseHeaderWidgetService: CaseHeaderWidgetService,
    private val objectMapper: ObjectMapper
) {
    private val logger = io.github.oshai.kotlinlogging.KotlinLogging.logger {}

    @Tool("Get case information. Returns metadata and data from widgets you can view.")
    fun getCaseInformation(
        @P("Document ID (UUID). If omitted, uses current case from page context.") documentId: String?
    ): String {
        logger.info { "getCaseInformation called with documentId=$documentId" }
        val docId = resolveDocumentId(documentId)
        if (docId == null) {
            logger.info { "Could not resolve document ID" }
            return "No document ID provided and not viewing a case."
        }
        logger.info { "Resolved document ID: $docId" }

        val document = try {
            documentService.findBy(JsonSchemaDocumentId.existingId(docId))
                .orElse(null)
        } catch (e: AccessDeniedException) {
            logger.warn { "Access denied for document $docId: ${e.message}" }
            return "You don't have permission to view this case."
        } catch (e: Exception) {
            logger.error(e) { "Error fetching document $docId" }
            return "Error fetching document: ${e.message}"
        }

        if (document == null) {
            logger.info { "Document not found: $docId" }
            return "Document not found."
        }
        logger.info { "Found document: ${document.id()}" }

        return try {
            val result = mutableMapOf<String, Any?>()
            result["metadata"] = buildMetadata(document as JsonSchemaDocument)
            result["header"] = getHeaderWidgetData(document)
            result["tabs"] = getTabsData(document)

            val jsonResult = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result)
            logger.info { "Returning case info (${jsonResult.length} chars)" }
            jsonResult
        } catch (e: Exception) {
            logger.error(e) { "Error building case info response" }
            "Error retrieving case details: ${e.message}"
        }
    }

    private fun resolveDocumentId(documentId: String?): UUID? {
        if (documentId != null) {
            return try {
                UUID.fromString(documentId)
            } catch (e: IllegalArgumentException) {
                null
            }
        }

        val pageContext = ToolContextHolder.getOrNull()?.pageContext ?: return null
        if (pageContext.page == "case-detail" && pageContext.resourceId != null) {
            return try {
                UUID.fromString(pageContext.resourceId)
            } catch (e: IllegalArgumentException) {
                null
            }
        }
        return null
    }

    private fun buildMetadata(document: JsonSchemaDocument): Map<String, Any?> {
        return mapOf(
            "id" to document.id().id.toString(),
            "caseDefinitionKey" to document.definitionId().name(),
            "caseDefinitionVersionTag" to document.definitionId().caseDefinitionId().versionTag?.toString(),
            "sequence" to document.sequence(),
            "createdOn" to document.createdOn()?.toString(),
            "modifiedOn" to document.modifiedOn()?.orElse(null)?.toString(),
            "createdBy" to document.createdBy(),
            "internalStatus" to document.internalStatus(),
            "assigneeId" to document.assigneeId(),
            "assigneeFullName" to document.assigneeFullName(),
            "assignedTeamKey" to document.assignedTeamKey(),
            "assignedTeamTitle" to document.assignedTeamTitle()
        )
    }

    private fun getHeaderWidgetData(document: JsonSchemaDocument): Map<String, Any?>? {
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        val id = CaseDefinitionId(caseDefinitionId.key, caseDefinitionId.versionTag.toString())

        val widgetDto = runWithoutAuthorization { caseHeaderWidgetService.findById(id) } ?: return null

        val widget = CaseHeaderWidget(
            id = id,
            type = widgetDto.type,
            highContrast = widgetDto.highContrast,
            properties = widgetDto.properties
        )

        return try {
            val data = caseWidgetService.getCaseHeaderWidgetData(document, widget, Pageable.unpaged(), caseDefinitionId)
            mapOf(
                "type" to widgetDto.type,
                "data" to data
            )
        } catch (e: AccessDeniedException) {
            null
        }
    }

    private fun getTabsData(document: JsonSchemaDocument): List<Map<String, Any?>> {
        val documentId = JsonSchemaDocumentId.existingId(document.id().id)
        val tabs = caseTabService.getCaseTabs(documentId)

        return tabs
            .filter { it.type == CaseTabType.WIDGETS }
            .mapNotNull { tab ->
                val widgetTab = caseWidgetService.getWidgetTab(documentId, tab.id.key) ?: return@mapNotNull null

                val widgetsData = widgetTab.widgets.mapNotNull { widget ->
                    try {
                        val data = caseWidgetService.getCaseWidgetData(
                            document.id().id,
                            tab.id.key,
                            widget.key,
                            Pageable.unpaged()
                        )
                        mapOf(
                            "key" to widget.key,
                            "title" to widget.title,
                            "type" to widget::class.simpleName?.removeSuffix("Dto")?.lowercase(),
                            "data" to data
                        )
                    } catch (e: AccessDeniedException) {
                        null
                    } catch (e: Exception) {
                        logger.debug { "Could not get widget data for ${widget.key}: ${e.message}" }
                        null
                    }
                }

                if (widgetsData.isEmpty()) {
                    return@mapNotNull null
                }

                mapOf(
                    "key" to tab.id.key,
                    "name" to tab.name,
                    "widgets" to widgetsData
                )
            }
    }
}
