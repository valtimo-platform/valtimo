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

package com.ritense.processdocument.service

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationResourceContext
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.case.service.StartableItemProvider
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class StartableProcessItemProvider(
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val authorizationService: AuthorizationService,
    private val repositoryService: OperatonRepositoryService,
) : StartableItemProvider {

    override val type: StartableItemType = StartableItemType.PROCESS

    override fun getStartableItems(
        caseDefinitionId: CaseDefinitionId,
        document: Document?
    ): List<StartableItemDto> {
        return processDefinitionCaseDefinitionRepository
            .findAll(caseDefinitionId, startableByUser = true, canInitializeDocument = null)
            .filter { isProcessDefinitionActive(it.id.processDefinitionId.id) }
            .filter { hasExecutionPermission(it.id.processDefinitionId.id, document) }
            .map { pdcd ->
                StartableItemDto(
                    type = StartableItemType.PROCESS,
                    name = pdcd.processDefinitionName,
                    key = pdcd.processDefinitionKey ?: error("Process definition key is null"),
                    versionTag = null,
                    processDefinitionId = pdcd.id.processDefinitionId.id
                )
            }
    }

    override fun createItem(caseDefinitionId: CaseDefinitionId, properties: JsonNode): StartableItemDto {
        val processDefinitionId = properties.get("processDefinitionId")?.asText()
            ?: throw IllegalArgumentException("processDefinitionId is required")

        val pdcd = processDefinitionCaseDefinitionRepository
            .findAllByIdCaseDefinitionIdAndIdProcessDefinitionIdId(caseDefinitionId, processDefinitionId)
            .firstOrNull()
            ?: throw NoSuchElementException("Process definition '$processDefinitionId' is not linked to case definition '$caseDefinitionId'")

        val processDefinitionName = pdcd.processDefinitionName
        val processDefinitionKey = pdcd.processDefinitionKey
            ?: error("Process definition key is null")

        if (!pdcd.startableByUser) {
            processDefinitionCaseDefinitionRepository.save(pdcd.copy(startableByUser = true))
        }

        return StartableItemDto(
            type = StartableItemType.PROCESS,
            name = processDefinitionName,
            key = processDefinitionKey,
            versionTag = null,
            processDefinitionId = pdcd.id.processDefinitionId.id
        )
    }

    override fun updateItem(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String?,
        properties: JsonNode
    ): StartableItemDto {
        val processDefinitionId = properties.get("processDefinitionId")?.asText()
            ?: throw IllegalArgumentException("processDefinitionId is required")

        val pdcd = processDefinitionCaseDefinitionRepository
            .findAllByIdCaseDefinitionIdAndIdProcessDefinitionIdId(caseDefinitionId, processDefinitionId)
            .firstOrNull()
            ?: throw NoSuchElementException("Process definition '$processDefinitionId' is not linked to case definition '$caseDefinitionId'")

        if (!pdcd.startableByUser) {
            processDefinitionCaseDefinitionRepository.save(pdcd.copy(startableByUser = true))
        }

        return StartableItemDto(
            type = StartableItemType.PROCESS,
            name = pdcd.processDefinitionName,
            key = itemKey,
            versionTag = versionTag,
            processDefinitionId = pdcd.id.processDefinitionId.id
        )
    }

    override fun deleteItem(caseDefinitionId: CaseDefinitionId, itemKey: String, versionTag: String?) {
        processDefinitionCaseDefinitionRepository
            .findByIdCaseDefinitionId(caseDefinitionId)
            .filter { it.processDefinitionKey == itemKey && it.startableByUser }
            .forEach { pdcd ->
                processDefinitionCaseDefinitionRepository.save(pdcd.copy(startableByUser = false))
            }
    }

    private fun isProcessDefinitionActive(processDefinitionId: String): Boolean {
        val definition = com.ritense.authorization.AuthorizationContext.runWithoutAuthorization {
            repositoryService.findProcessDefinitionById(processDefinitionId)
        }
        return definition != null && !definition.isSuspended()
    }

    private fun hasExecutionPermission(processDefinitionId: String, document: Document?): Boolean {
        val request = RelatedEntityAuthorizationRequest(
            OperatonExecution::class.java,
            OperatonExecutionActionProvider.CREATE,
            OperatonProcessDefinition::class.java,
            processDefinitionId
        )
        if (document != null) {
            request.withContext(
                AuthorizationResourceContext(
                    JsonSchemaDocument::class.java,
                    document as JsonSchemaDocument
                )
            )
        }
        return authorizationService.hasPermission(request)
    }
}
