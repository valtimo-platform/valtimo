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

package com.ritense.valtimo.processlink.service

import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.contract.plugin.DanglingPluginConfigurationDto
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
open class PluginConfigurationMappingResolverImpl(
    private val pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
    private val pluginConfigurationRepository: PluginConfigurationRepository,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val applicationEventPublisher: ApplicationEventPublisher,
) : PluginConfigurationMappingResolver {

    override fun resolve(caseDefinitionId: CaseDefinitionId, mappings: Map<UUID, UUID>) {
        caseDefinitionChecker.assertCanUpdateCaseDefinitionConfiguration(
            caseDefinitionId, PluginProcessLinkMapper.ISSUE_TYPE
        )

        val processDefinitionIds = processDefinitionCaseDefinitionService
            .findProcessDefinitionCaseDefinitions(caseDefinitionId)
            .map { it.id.processDefinitionId.id }

        val allPluginLinks = processDefinitionIds.flatMap { pdId ->
            pluginProcessLinkRepository.findByProcessDefinitionId(pdId)
        }.filter { it.pluginConfigurationReference.type == PluginConfigurationReferenceType.FIXED }

        for (link in allPluginLinks) {
            // Match by pluginConfigurationId if present, otherwise by process link id
            val lookupId = link.pluginConfigurationId?.id ?: link.id
            val mappedId = mappings[lookupId] ?: continue

            val updatedLink = link.copy(
                pluginConfigurationId = PluginConfigurationId.existingId(mappedId),
                pluginConfigurationReference = PluginConfigurationReference(
                    type = PluginConfigurationReferenceType.FIXED,
                    pluginDefinitionKey = link.pluginConfigurationReference.pluginDefinitionKey,
                ),
            )
            pluginProcessLinkRepository.save(updatedLink)
        }

        checkForRemainingIssues(caseDefinitionId, processDefinitionIds)
    }

    override fun getDanglingPluginConfigurations(
        caseDefinitionId: CaseDefinitionId
    ): List<DanglingPluginConfigurationDto> {
        val processDefinitionIds = processDefinitionCaseDefinitionService
            .findProcessDefinitionCaseDefinitions(caseDefinitionId)
            .map { it.id.processDefinitionId.id }

        val allPluginLinks = processDefinitionIds.flatMap { pdId ->
            pluginProcessLinkRepository.findByProcessDefinitionId(pdId)
        }.filter { it.pluginConfigurationReference.type == PluginConfigurationReferenceType.FIXED }

        val danglingLinks = allPluginLinks.filter { link ->
            link.pluginConfigurationId == null ||
                !pluginConfigurationRepository.existsById(link.pluginConfigurationId!!)
        }

        return danglingLinks
            .groupBy { it.pluginConfigurationReference.pluginDefinitionKey }
            .map { (definitionKey, links) ->
                DanglingPluginConfigurationDto(
                    pluginDefinitionKey = definitionKey,
                    sourcePluginConfigurationIds = links.map { it.pluginConfigurationId?.id ?: it.id }.toSet(),
                )
            }
    }

    override fun recheckIssuesForProcessDefinition(processDefinitionId: String) {
        val link = processDefinitionCaseDefinitionService
            .findByProcessDefinitionIdOrNull(ProcessDefinitionId.of(processDefinitionId))
            ?: return
        val caseDefinitionId = link.id.caseDefinitionId

        val processDefinitionIds = processDefinitionCaseDefinitionService
            .findProcessDefinitionCaseDefinitions(caseDefinitionId)
            .map { it.id.processDefinitionId.id }
        checkForRemainingIssues(caseDefinitionId, processDefinitionIds)
    }

    private fun checkForRemainingIssues(
        caseDefinitionId: CaseDefinitionId,
        processDefinitionIds: List<String>,
    ) {
        val allPluginLinks = processDefinitionIds.flatMap { pdId ->
            pluginProcessLinkRepository.findByProcessDefinitionId(pdId)
        }

        val hasIssue = allPluginLinks.any { link ->
            link.pluginConfigurationReference.type == PluginConfigurationReferenceType.FIXED &&
                (link.pluginConfigurationId == null ||
                    !pluginConfigurationRepository.existsById(link.pluginConfigurationId!!))
        }

        if (hasIssue) {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueDetectedEvent(caseDefinitionId, PluginProcessLinkMapper.ISSUE_TYPE)
            )
        } else {
            applicationEventPublisher.publishEvent(
                CaseConfigurationIssueResolvedEvent(caseDefinitionId, PluginProcessLinkMapper.ISSUE_TYPE)
            )
        }
    }
}
