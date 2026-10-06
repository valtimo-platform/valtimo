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

package com.ritense.buildingblock.service.versionmigration

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.operaton.bpm.engine.RepositoryService
import org.springframework.stereotype.Component

/** Reads every building block reference and the container that owns it; references in unowned or detached processes are not usages. */
@Component
@SkipComponentScan
class BuildingBlockUsageIndexLoader(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val buildingBlockProcessLinkRepository: BuildingBlockProcessLinkRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val repositoryService: RepositoryService,
) {

    /** With [childKey], only the references to versions of that building block are read. */
    fun load(childKey: String? = null): BuildingBlockUsageIndex {
        val containers = buildingBlockDefinitionRepository.findAll().map {
            MigrationContainerInfo(MigrationContainer.of(it.id), it.final, it.basedOnVersionTag, it.name)
        } + caseDefinitionRepository.findAll().map {
            MigrationContainerInfo(MigrationContainer.of(it.id), it.final, it.basedOnVersionTag, it.name)
        }

        val owners = processDefinitionBuildingBlockDefinitionRepository.findAll()
            .associate { it.id.processDefinitionId.id to MigrationContainer.of(it.id.buildingBlockDefinitionId) } +
            processDefinitionCaseDefinitionRepository.findAll()
                .associate { it.id.processDefinitionId.id to MigrationContainer.of(it.id.caseDefinitionId) }

        val allProcessLinks = if (childKey == null) {
            buildingBlockProcessLinkRepository.findAll()
        } else {
            buildingBlockProcessLinkRepository.findAllByBuildingBlockDefinitionIdKey(childKey)
        }
        val processLinks = allProcessLinks
            .filter { owners.containsKey(it.processDefinitionId) }
        val processDefinitionKeys = processDefinitionKeys(processLinks.map { it.processDefinitionId }.toSet())

        val processLinkReferences = processLinks.mapNotNull { link ->
            val processDefinitionKey = processDefinitionKeys[link.processDefinitionId] ?: return@mapNotNull null
            UsageReference(
                container = owners.getValue(link.processDefinitionId),
                location = ProcessLinkLocation(processDefinitionKey, link.activityId),
                child = link.buildingBlockDefinitionId,
                linkId = link.id,
                processDefinitionId = link.processDefinitionId,
                inputMappings = link.inputMappings,
                outputMappings = link.outputMappings,
                pluginConfigurationMappings = link.pluginConfigurationMappings,
            )
        }

        val caseLinks = if (childKey == null) {
            caseDefinitionBuildingBlockLinkRepository.findAll()
        } else {
            caseDefinitionBuildingBlockLinkRepository.findAllByBuildingBlockDefinitionIdKey(childKey)
        }
        val caseLinkReferences = caseLinks.map { link ->
            UsageReference(
                container = MigrationContainer.of(link.caseDefinitionId),
                location = CaseLinkLocation(link.buildingBlockDefinitionId.key),
                child = link.buildingBlockDefinitionId,
                linkId = link.id,
                processDefinitionId = null,
                inputMappings = link.inputMappings,
                outputMappings = link.outputMappings,
                pluginConfigurationMappings = link.pluginConfigurationMappings,
            )
        }

        return BuildingBlockUsageIndex(processLinkReferences + caseLinkReferences, containers)
    }

    private fun processDefinitionKeys(processDefinitionIds: Set<String>): Map<String, String> =
        processDefinitionIds.chunked(QUERY_CHUNK_SIZE).flatMap { chunk ->
            repositoryService.createProcessDefinitionQuery()
                .processDefinitionIdIn(*chunk.toTypedArray())
                .list()
        }.associate { it.id to it.key }

    private companion object {
        const val QUERY_CHUNK_SIZE = 500
    }
}
