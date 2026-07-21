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

package com.ritense.externalplugin.service

import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case.repository.CaseTabSpecificationHelper
import com.ritense.case_.domain.tab.CaseExternalPluginTab
import com.ritense.case_.repository.CaseExternalPluginTabRepository
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.processlink.ExternalPluginProcessLinkMapper.Companion.ISSUE_TYPE
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.contract.plugin.DanglingPluginConfigurationDto
import com.ritense.valtimo.contract.plugin.DanglingPluginConfigurationDto.Companion.SOURCE_EXTERNAL
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * External-plugin counterpart to `PluginConfigurationMappingResolverImpl` (D1). Repairs `FIXED`
 * external-plugin process links (service-task and task-form), and `EXTERNAL_PLUGIN` case tabs whose
 * `contentKey`-embedded configuration id is dangling — behind the same
 * `dangling-plugin-configurations` / `plugin-configuration-mappings` endpoints, distinguished by the
 * `source` discriminator on [DanglingPluginConfigurationDto].
 */
@Transactional
open class ExternalPluginConfigurationMappingResolver(
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
    private val taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val caseExternalPluginTabRepository: CaseExternalPluginTabRepository,
    private val caseTabRepository: CaseTabRepository,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val applicationEventPublisher: ApplicationEventPublisher,
) : PluginConfigurationMappingResolver {

    override fun resolve(caseDefinitionId: CaseDefinitionId, mappings: Map<UUID, UUID>) {
        caseDefinitionChecker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, ISSUE_TYPE)

        val processDefinitionIds = processDefinitionIdsFor(caseDefinitionId)

        resolveProcessLinks(processDefinitionIds, mappings)
        resolveTaskFormProcessLinks(processDefinitionIds, mappings)
        resolveCaseTabs(caseDefinitionId, mappings)

        checkForRemainingIssues(caseDefinitionId, processDefinitionIds)
    }

    override fun getDanglingPluginConfigurations(caseDefinitionId: CaseDefinitionId): List<DanglingPluginConfigurationDto> {
        val processDefinitionIds = processDefinitionIdsFor(caseDefinitionId)

        val danglingLinks = allLinks(processDefinitionIds)
            .filter { it.pluginConfigurationReference.type == FIXED }
            .filter { link ->
                val configId = link.externalPluginConfigurationId
                configId == null || !configurationRepository.existsById(configId)
            }
            .groupBy { it.pluginConfigurationReference.pluginDefinitionKey to it.pluginConfigurationReference.pluginDefinitionVersion }
            .map { (keyAndVersion, links) ->
                val (definitionKey, version) = keyAndVersion
                DanglingPluginConfigurationDto(
                    pluginDefinitionKey = definitionKey,
                    sourcePluginConfigurationIds = links.map { it.externalPluginConfigurationId ?: it.id }.toSet(),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = version,
                )
            }

        val danglingTaskFormLinks = allTaskFormLinks(processDefinitionIds)
            .filter { !configurationRepository.existsById(it.externalPluginConfigurationId) }
            .groupBy { it.pluginConfigurationReference.pluginDefinitionKey to it.pluginConfigurationReference.pluginDefinitionVersion }
            .map { (keyAndVersion, links) ->
                val (definitionKey, version) = keyAndVersion
                DanglingPluginConfigurationDto(
                    pluginDefinitionKey = definitionKey,
                    sourcePluginConfigurationIds = links.map { it.externalPluginConfigurationId }.toSet(),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = version,
                )
            }

        val danglingTabConfigurations = danglingTabsFor(caseDefinitionId)

        return danglingLinks + danglingTaskFormLinks + danglingTabConfigurations
    }

    override fun recheckIssuesForProcessDefinition(processDefinitionId: String) {
        val link = processDefinitionCaseDefinitionService
            .findByProcessDefinitionIdOrNull(ProcessDefinitionId.of(processDefinitionId))
            ?: return
        val caseDefinitionId = link.id.caseDefinitionId
        val processDefinitionIds = processDefinitionIdsFor(caseDefinitionId)
        checkForRemainingIssues(caseDefinitionId, processDefinitionIds)
    }

    private fun resolveProcessLinks(processDefinitionIds: List<String>, mappings: Map<UUID, UUID>) {
        val links = allLinks(processDefinitionIds).filter { it.pluginConfigurationReference.type == FIXED }
        for (link in links) {
            val lookupId = link.externalPluginConfigurationId ?: link.id
            val mappedId = mappings[lookupId] ?: continue

            val updated = link.copy(
                externalPluginConfigurationId = mappedId,
                pluginConfigurationReference = PluginConfigurationReference(
                    type = FIXED,
                    pluginDefinitionKey = link.pluginConfigurationReference.pluginDefinitionKey,
                    pluginDefinitionVersion = link.pluginConfigurationReference.pluginDefinitionVersion,
                ),
            )
            processLinkRepository.save(updated)
        }
    }

    private fun resolveTaskFormProcessLinks(processDefinitionIds: List<String>, mappings: Map<UUID, UUID>) {
        val links = allTaskFormLinks(processDefinitionIds)
        for (link in links) {
            val mappedId = mappings[link.externalPluginConfigurationId] ?: continue

            val updated = link.copy(
                externalPluginConfigurationId = mappedId,
                pluginConfigurationReference = PluginConfigurationReference(
                    type = FIXED,
                    pluginDefinitionKey = link.pluginConfigurationReference.pluginDefinitionKey,
                    pluginDefinitionVersion = link.pluginConfigurationReference.pluginDefinitionVersion,
                ),
            )
            taskFormProcessLinkRepository.save(updated)
        }
    }

    private fun resolveCaseTabs(caseDefinitionId: CaseDefinitionId, mappings: Map<UUID, UUID>) {
        val externalPluginTabs = caseTabsFor(caseDefinitionId)
            .filter { it.type == CaseTabType.EXTERNAL_PLUGIN }

        for (tab in externalPluginTabs) {
            val configPart = tab.contentKey.substringBefore(':')
            val bundlePart = tab.contentKey.substringAfter(':', "")
            val originalId = configPart.toUuidOrNull() ?: continue
            val mappedId = mappings[originalId] ?: continue

            val newContentKey = if (bundlePart.isEmpty()) mappedId.toString() else "$mappedId:$bundlePart"
            val updatedTab = tab.copy(contentKey = newContentKey)
            caseTabRepository.save(updatedTab)
            caseExternalPluginTabRepository.save(
                CaseExternalPluginTab(
                    id = updatedTab.id,
                    externalPluginConfigurationId = mappedId,
                    bundleKey = bundlePart.ifEmpty { null },
                )
            )
        }
    }

    private fun danglingTabsFor(caseDefinitionId: CaseDefinitionId): List<DanglingPluginConfigurationDto> {
        val danglingConfigIds = caseTabsFor(caseDefinitionId)
            .filter { it.type == CaseTabType.EXTERNAL_PLUGIN }
            .mapNotNull { it.contentKey.substringBefore(':').toUuidOrNull() }
            .filter { !configurationRepository.existsById(it) }
            .toSet()

        if (danglingConfigIds.isEmpty()) return emptyList()

        return listOf(
            DanglingPluginConfigurationDto(
                pluginDefinitionKey = null,
                sourcePluginConfigurationIds = danglingConfigIds,
                source = SOURCE_EXTERNAL,
                pluginDefinitionVersion = null,
            )
        )
    }

    private fun checkForRemainingIssues(caseDefinitionId: CaseDefinitionId, processDefinitionIds: List<String>) {
        val hasProcessLinkIssue = allLinks(processDefinitionIds).any { link ->
            link.pluginConfigurationReference.type == FIXED &&
                (link.externalPluginConfigurationId == null || !configurationRepository.existsById(link.externalPluginConfigurationId))
        }
        val hasTaskFormIssue = allTaskFormLinks(processDefinitionIds).any { link ->
            !configurationRepository.existsById(link.externalPluginConfigurationId)
        }
        val hasTabIssue = danglingTabsFor(caseDefinitionId).isNotEmpty()

        if (hasProcessLinkIssue || hasTaskFormIssue || hasTabIssue) {
            applicationEventPublisher.publishEvent(CaseConfigurationIssueDetectedEvent(caseDefinitionId, ISSUE_TYPE))
        } else {
            applicationEventPublisher.publishEvent(CaseConfigurationIssueResolvedEvent(caseDefinitionId, ISSUE_TYPE))
        }
    }

    private fun processDefinitionIdsFor(caseDefinitionId: CaseDefinitionId): List<String> =
        processDefinitionCaseDefinitionService
            .findProcessDefinitionCaseDefinitions(caseDefinitionId)
            .map { it.id.processDefinitionId.id }

    private fun allLinks(processDefinitionIds: List<String>): List<ExternalPluginProcessLink> =
        processDefinitionIds.flatMap { processLinkRepository.findByProcessDefinitionId(it) }

    private fun allTaskFormLinks(processDefinitionIds: List<String>): List<ExternalPluginTaskFormProcessLink> =
        processDefinitionIds.flatMap { taskFormProcessLinkRepository.findByProcessDefinitionId(it) }

    private fun caseTabsFor(caseDefinitionId: CaseDefinitionId): List<CaseTab> =
        caseTabRepository.findAll(CaseTabSpecificationHelper.byCaseDefinitionId(caseDefinitionId))

    private fun String.toUuidOrNull(): UUID? = try {
        UUID.fromString(this)
    } catch (_: IllegalArgumentException) {
        null
    }
}
