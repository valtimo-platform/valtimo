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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationResourceContext
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.case.service.StartableItemProvider
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.authorization.OperatonExecutionActionProvider
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class StartableBuildingBlockItemProvider(
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val authorizationService: AuthorizationService,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val objectMapper: ObjectMapper,
) : StartableItemProvider {

    override val type: StartableItemType = StartableItemType.BUILDING_BLOCK

    override fun getStartableItems(
        caseDefinitionId: CaseDefinitionId,
        document: Document?
    ): List<StartableItemDto> {
        return linkRepository
            .findAllByCaseDefinitionId(caseDefinitionId)
            .mapNotNull { link ->
                val mainProcessLink = processDefinitionBuildingBlockDefinitionRepository
                    .findByIdBuildingBlockDefinitionIdAndMain(link.buildingBlockDefinitionId, true)
                    ?: return@mapNotNull null
                val processDefinitionId = mainProcessLink.id.processDefinitionId.id
                if (!hasExecutionPermission(processDefinitionId, document)) {
                    return@mapNotNull null
                }
                StartableItemDto(
                    type = StartableItemType.BUILDING_BLOCK,
                    name = mainProcessLink.processDefinitionName ?: link.buildingBlockDefinitionId.key,
                    key = link.buildingBlockDefinitionId.key,
                    versionTag = link.buildingBlockDefinitionId.versionTag.toString(),
                    processDefinitionId = processDefinitionId
                )
            }
    }

    override fun createItem(caseDefinitionId: CaseDefinitionId, properties: JsonNode): StartableItemDto {
        val dto = objectMapper.treeToValue(properties, CreateCaseDefinitionBuildingBlockLinkDto::class.java)
        val linkDto = caseDefinitionBuildingBlockLinkService.createLink(caseDefinitionId, dto)

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            linkDto.buildingBlockDefinitionKey,
            linkDto.buildingBlockDefinitionVersionTag
        )
        val mainProcessLink = processDefinitionBuildingBlockDefinitionRepository
            .findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true)

        return StartableItemDto(
            type = StartableItemType.BUILDING_BLOCK,
            name = mainProcessLink?.processDefinitionName ?: linkDto.buildingBlockDefinitionKey,
            key = linkDto.buildingBlockDefinitionKey,
            versionTag = linkDto.buildingBlockDefinitionVersionTag,
            processDefinitionId = mainProcessLink?.id?.processDefinitionId?.id
        )
    }

    override fun deleteItem(caseDefinitionId: CaseDefinitionId, itemKey: String, versionTag: String) {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(itemKey, versionTag)
        caseDefinitionBuildingBlockLinkService.deleteLink(caseDefinitionId, buildingBlockDefinitionId)
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
