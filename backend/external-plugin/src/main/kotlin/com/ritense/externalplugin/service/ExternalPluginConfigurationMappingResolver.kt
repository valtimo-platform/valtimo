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
import com.ritense.case_.service.CaseExternalPluginWidgetService
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.processlink.ExternalPluginProcessLinkMapper
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormProcessLinkMapper
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
import org.springframework.data.repository.findByIdOrNull
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
    private val caseExternalPluginWidgetService: CaseExternalPluginWidgetService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val applicationEventPublisher: ApplicationEventPublisher,
) : PluginConfigurationMappingResolver {

    override fun resolve(caseDefinitionId: CaseDefinitionId, mappings: Map<UUID, UUID>) {
        caseDefinitionChecker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, ALL_ISSUE_TYPES)

        val processDefinitionIds = processDefinitionIdsFor(caseDefinitionId)

        resolveProcessLinks(processDefinitionIds, mappings)
        resolveTaskFormProcessLinks(processDefinitionIds, mappings)
        resolveCaseTabs(caseDefinitionId, mappings)
        caseExternalPluginWidgetService.remapConfiguration(caseDefinitionId, mappings)

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
        val danglingWidgetConfigurations = danglingWidgetsFor(caseDefinitionId)

        return danglingLinks + danglingTaskFormLinks + danglingTabConfigurations + danglingWidgetConfigurations
    }

    override fun recheckIssuesForProcessDefinition(processDefinitionId: String) {
        val link = processDefinitionCaseDefinitionService
            .findByProcessDefinitionIdOrNull(ProcessDefinitionId.of(processDefinitionId))
            ?: return
        val caseDefinitionId = link.id.caseDefinitionId
        val processDefinitionIds = processDefinitionIdsFor(caseDefinitionId)
        checkForRemainingIssues(caseDefinitionId, processDefinitionIds)
    }

    /**
     * In-transaction recheck for a whole case definition, triggered from `CaseTabImporter.afterImport`
     * so a dangling `EXTERNAL_PLUGIN` case tab is detected reliably at import time. (The tab surface
     * has no process link, so it would otherwise depend on an incidental process-link recheck, which
     * fires only AFTER_COMMIT and does not persist during import.) Re-publishes all three per-surface
     * verdicts; idempotent when a surface is already correct.
     */
    override fun recheckIssuesForCaseDefinition(caseDefinitionId: CaseDefinitionId) {
        checkForRemainingIssues(caseDefinitionId, processDefinitionIdsFor(caseDefinitionId))
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
            val existingSideRow = caseExternalPluginTabRepository.findByIdOrNull(tab.id)
            caseTabRepository.save(updatedTab)
            caseExternalPluginTabRepository.save(
                CaseExternalPluginTab(
                    id = updatedTab.id,
                    externalPluginConfigurationId = mappedId,
                    bundleKey = bundlePart.ifEmpty { null },
                    // The chooser maps to a configuration of the same plugin, so the plugin identity
                    // is unchanged — preserve it rather than re-deriving it.
                    pluginDefinitionKey = existingSideRow?.pluginDefinitionKey,
                    pluginDefinitionVersion = existingSideRow?.pluginDefinitionVersion,
                )
            )
        }
    }

    private fun danglingTabsFor(caseDefinitionId: CaseDefinitionId): List<DanglingPluginConfigurationDto> {
        val danglingTabs = caseTabsFor(caseDefinitionId)
            .filter { it.type == CaseTabType.EXTERNAL_PLUGIN }
            .mapNotNull { caseExternalPluginTabRepository.findByIdOrNull(it.id) }
            .filter { !configurationRepository.existsById(it.externalPluginConfigurationId) }

        if (danglingTabs.isEmpty()) return emptyList()

        // Group by the persisted plugin identity so the repair panel can offer a per-plugin chooser,
        // exactly like a dangling process link — instead of the old single key-less "unidentifiable"
        // entry that forced a manual reconfigure.
        return danglingTabs
            .groupBy { it.pluginDefinitionKey to it.pluginDefinitionVersion }
            .map { (keyAndVersion, sideRows) ->
                val (pluginDefinitionKey, pluginDefinitionVersion) = keyAndVersion
                DanglingPluginConfigurationDto(
                    pluginDefinitionKey = pluginDefinitionKey,
                    sourcePluginConfigurationIds = sideRows.map { it.externalPluginConfigurationId }.toSet(),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = pluginDefinitionVersion,
                )
            }
    }

    /**
     * Dangling = external-plugin widgets whose referenced configuration cannot be resolved in this
     * environment, grouped by the design-time plugin identity carried from a self-describing import
     * (so the repair panel can offer a per-plugin chooser, exactly like a dangling tab). The source
     * ids are the widgets' current (unresolvable) configuration ids — the same ids the repair maps
     * from.
     */
    private fun danglingWidgetsFor(caseDefinitionId: CaseDefinitionId): List<DanglingPluginConfigurationDto> {
        val danglingWidgets = caseExternalPluginWidgetService.findExternalPluginWidgets(caseDefinitionId)
            .filter { it.configurationId != null && !configurationRepository.existsById(it.configurationId) }

        if (danglingWidgets.isEmpty()) return emptyList()

        return danglingWidgets
            .groupBy { it.pluginDefinitionKey to it.pluginDefinitionVersion }
            .map { (keyAndVersion, widgets) ->
                val (pluginDefinitionKey, pluginDefinitionVersion) = keyAndVersion
                DanglingPluginConfigurationDto(
                    pluginDefinitionKey = pluginDefinitionKey,
                    sourcePluginConfigurationIds = widgets.mapNotNull { it.configurationId }.toSet(),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = pluginDefinitionVersion,
                )
            }
    }

    /**
     * Each external surface owns its own issue type and is judged independently, so one surface being
     * clean can never clear another surface's issue (the cross-surface clobber that a single shared
     * type suffered). Mirrors the per-surface `afterImport` detection on the mappers.
     */
    private fun checkForRemainingIssues(caseDefinitionId: CaseDefinitionId, processDefinitionIds: List<String>) {
        publishIssue(caseDefinitionId, PROCESS_LINK_ISSUE_TYPE, hasProcessLinkIssue(processDefinitionIds))
        publishIssue(caseDefinitionId, TASK_FORM_ISSUE_TYPE, hasTaskFormIssue(processDefinitionIds))
        publishIssue(caseDefinitionId, CASE_TAB_ISSUE_TYPE, danglingTabsFor(caseDefinitionId).isNotEmpty())
        publishIssue(caseDefinitionId, CASE_WIDGET_ISSUE_TYPE, danglingWidgetsFor(caseDefinitionId).isNotEmpty())
    }

    private fun hasProcessLinkIssue(processDefinitionIds: List<String>) =
        allLinks(processDefinitionIds).any { link ->
            link.pluginConfigurationReference.type == FIXED &&
                (link.externalPluginConfigurationId == null || !configurationRepository.existsById(link.externalPluginConfigurationId))
        }

    private fun hasTaskFormIssue(processDefinitionIds: List<String>) =
        allTaskFormLinks(processDefinitionIds).any { link ->
            !configurationRepository.existsById(link.externalPluginConfigurationId)
        }

    private fun publishIssue(caseDefinitionId: CaseDefinitionId, issueType: String, hasIssue: Boolean) {
        val event = if (hasIssue) {
            CaseConfigurationIssueDetectedEvent(caseDefinitionId, issueType)
        } else {
            CaseConfigurationIssueResolvedEvent(caseDefinitionId, issueType)
        }
        applicationEventPublisher.publishEvent(event)
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

    companion object {
        val PROCESS_LINK_ISSUE_TYPE = ExternalPluginProcessLinkMapper.ISSUE_TYPE
        val TASK_FORM_ISSUE_TYPE = ExternalPluginTaskFormProcessLinkMapper.ISSUE_TYPE
        const val CASE_TAB_ISSUE_TYPE = "external-plugin-case-tab"
        const val CASE_WIDGET_ISSUE_TYPE = "external-plugin-case-widget"

        private val ALL_ISSUE_TYPES = listOf(
            PROCESS_LINK_ISSUE_TYPE,
            TASK_FORM_ISSUE_TYPE,
            CASE_TAB_ISSUE_TYPE,
            CASE_WIDGET_ISSUE_TYPE,
        )
    }
}
