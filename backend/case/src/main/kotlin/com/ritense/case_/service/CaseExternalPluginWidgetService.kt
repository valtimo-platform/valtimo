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

package com.ritense.case_.service

import com.ritense.case.domain.CaseTab
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.domain.tab.CaseWidgetTab
import com.ritense.case_.repository.CaseWidgetTabRepository
import com.ritense.case_.repository.ExternalPluginCaseWidgetRepository
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidget
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.jpa.domain.Specification
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Query/mutation surface for `external-plugin` case widgets, consumed by the external-plugin module
 * (which compile-depends on `case`). Mirrors [CaseExternalPluginTabService] for the widget surface:
 * it lets the external-plugin dangling-repair resolver find/remap widgets by configuration id, and
 * lets the delete guard find the widgets that reference a configuration.
 *
 * The case module has no plugin knowledge, so it never decides which widgets are *dangling* — it
 * exposes every external-plugin widget (with its configuration id + plugin identity) and lets the
 * external-plugin resolver filter on configuration existence.
 */
@Service
@SkipComponentScan
@Transactional
class CaseExternalPluginWidgetService(
    private val externalPluginCaseWidgetRepository: ExternalPluginCaseWidgetRepository,
    private val caseWidgetTabRepository: CaseWidgetTabRepository,
    private val caseTabRepository: CaseTabRepository,
) {

    /**
     * All external-plugin widgets of a case definition, each with the configuration it references
     * and the design-time plugin identity carried from a self-describing import.
     */
    @Transactional(readOnly = true)
    fun findExternalPluginWidgets(caseDefinitionId: CaseDefinitionId): List<CaseExternalPluginWidgetRef> =
        widgetTabsFor(caseDefinitionId).flatMap { tab ->
            tab.widgets.filterIsInstance<ExternalPluginCaseWidget>().map { widget ->
                CaseExternalPluginWidgetRef(
                    caseDefinitionId = caseDefinitionId,
                    tabKey = tab.id.key,
                    widgetKey = widget.id.key,
                    configurationId = widget.externalPluginConfigurationId,
                    pluginDefinitionKey = widget.pluginDefinitionKey,
                    pluginDefinitionVersion = widget.pluginDefinitionVersion,
                )
            }
        }

    /**
     * Re-points external-plugin widgets of a case definition whose current configuration id is a key
     * in [mappings] to the mapped target id. Idempotent for widgets already resolved.
     */
    @Transactional
    fun remapConfiguration(caseDefinitionId: CaseDefinitionId, mappings: Map<UUID, UUID>) {
        if (mappings.isEmpty()) return
        widgetTabsFor(caseDefinitionId)
            .flatMap { it.widgets.filterIsInstance<ExternalPluginCaseWidget>() }
            .forEach { widget ->
                val currentId = widget.externalPluginConfigurationId ?: return@forEach
                val mappedId = mappings[currentId] ?: return@forEach
                externalPluginCaseWidgetRepository.save(widget.withExternalPluginConfigurationId(mappedId))
            }
    }

    /**
     * Lists external-plugin widgets that reference a given configuration, across every case
     * definition. Used by the external-plugin delete guard so a configuration backing a live widget
     * cannot be deleted.
     */
    @Transactional(readOnly = true)
    fun findUsagesForConfiguration(configurationId: UUID): List<CaseExternalPluginWidgetUsage> =
        externalPluginCaseWidgetRepository.findAllByExternalPluginConfigurationId(configurationId)
            .mapNotNull { widget ->
                val tabId = widget.id.caseWidgetTab?.id ?: return@mapNotNull null
                val tab: CaseTab? = caseTabRepository.findByIdOrNull(tabId)
                CaseExternalPluginWidgetUsage(
                    configurationId = configurationId,
                    caseDefinitionKey = tabId.caseDefinitionId.key,
                    caseDefinitionVersionTag = tabId.caseDefinitionId.versionTag.toString(),
                    tabKey = tabId.key,
                    tabName = tab?.name,
                    widgetKey = widget.id.key,
                )
            }

    private fun widgetTabsFor(caseDefinitionId: CaseDefinitionId): List<CaseWidgetTab> =
        caseWidgetTabRepository.findAll(byCaseDefinitionId(caseDefinitionId))

    private fun byCaseDefinitionId(caseDefinitionId: CaseDefinitionId) =
        Specification<CaseWidgetTab> { root, _, cb ->
            cb.equal(root.get<Any>("id").get<Any>("caseDefinitionId"), caseDefinitionId)
        }
}

/**
 * One external-plugin widget of a case definition: the configuration it references (`null` when it
 * imported dangling) plus the design-time plugin identity that keeps it identifiable in the repair
 * panel. Consumed by the external-plugin dangling-repair resolver.
 */
data class CaseExternalPluginWidgetRef(
    val caseDefinitionId: CaseDefinitionId,
    val tabKey: String,
    val widgetKey: String,
    val configurationId: UUID?,
    val pluginDefinitionKey: String?,
    val pluginDefinitionVersion: String?,
)

/**
 * One external-plugin widget that references a configuration. Mapped to a `PluginUsageDto` by the
 * external-plugin delete guard.
 */
data class CaseExternalPluginWidgetUsage(
    val configurationId: UUID,
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val tabKey: String,
    val tabName: String?,
    val widgetKey: String,
)
