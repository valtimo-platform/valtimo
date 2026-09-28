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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.repository.BuildingBlockProcessLinkRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.plugin.service.BuildingBlockPluginMappingUsage
import com.ritense.plugin.service.BuildingBlockPluginMappingUsageFinder
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class DefaultBuildingBlockPluginMappingUsageFinder(
    private val processLinkRepository: BuildingBlockProcessLinkRepository,
    private val caseLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
) : BuildingBlockPluginMappingUsageFinder {

    /**
     * The mappings live in JSON columns, so matching happens in memory — the platform supports
     * both PostgreSQL and MySQL, whose JSON query dialects differ. Both tables hold
     * configuration-time data (bounded by the number of linked activities / case-BB pairs), not
     * runtime data, so a full scan stays small.
     */
    override fun findUsages(configurationId: UUID): List<BuildingBlockPluginMappingUsage> {
        val processLinkUsages = processLinkRepository.findAll().flatMap { link ->
            link.pluginConfigurationMappings.filterValues { it == configurationId }.keys.map { mappingKey ->
                BuildingBlockPluginMappingUsage(
                    mappingKey = mappingKey,
                    buildingBlockDefinitionKey = link.buildingBlockDefinitionId.key,
                    processLinkId = link.id,
                    processDefinitionId = link.processDefinitionId,
                    activityId = link.activityId,
                )
            }
        }

        val caseLinkUsages = caseLinkRepository.findAll().flatMap { caseLink ->
            caseLink.pluginConfigurationMappings.filterValues { it == configurationId }.keys.map { mappingKey ->
                BuildingBlockPluginMappingUsage(
                    mappingKey = mappingKey,
                    buildingBlockDefinitionKey = caseLink.buildingBlockDefinitionId.key,
                    caseDefinitionKey = caseLink.caseDefinitionId.key,
                    caseDefinitionVersionTag = caseLink.caseDefinitionId.versionTag.toString(),
                )
            }
        }

        return processLinkUsages + caseLinkUsages
    }
}
