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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationResourceContext
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case.service.CaseTabActionProvider.Companion.VIEW
import com.ritense.case_.domain.tab.CaseExternalPluginTab
import com.ritense.case_.repository.CaseExternalPluginTabRepository
import com.ritense.case_.rest.dto.ExternalPluginTabContentDto
import com.ritense.case_.rest.dto.ExternalPluginTabContext
import com.ritense.case_.service.event.CaseTabCreatedEvent
import com.ritense.case_.service.event.CaseTabUpdatedEvent
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.findByOrNull
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Optional
import java.util.UUID

/**
 * Lifecycle + content service for `EXTERNAL_PLUGIN` case tabs. Mirrors [CaseWidgetService] for the
 * WIDGETS type: it creates the side row on tab creation and serves PBAC-checked content for the
 * detail view. The actual bundle URL is resolved through the [ExternalPluginCaseTabResolver] SPI
 * (Optional, so the case module runs without the external-plugin module on the classpath).
 */
@Service
@SkipComponentScan
@Transactional(readOnly = false)
class CaseExternalPluginTabService(
    private val documentService: DocumentService,
    private val caseExternalPluginTabRepository: CaseExternalPluginTabRepository,
    private val caseTabRepository: CaseTabRepository,
    private val authorizationService: AuthorizationService,
    private val resolver: Optional<ExternalPluginCaseTabResolver>,
) {

    /**
     * On creation of an `EXTERNAL_PLUGIN` tab, persists the side row. The configuration id and the
     * (optional) bundle key are carried in the generic `contentKey` as `"<configId>[:<bundleKey>]"`
     * (Phase 2.7) — this keeps the generic create path untouched, exactly as WIDGETS needs no extra
     * create fields.
     */
    @EventListener(CaseTabCreatedEvent::class)
    fun handleCaseTabCreatedEvent(event: CaseTabCreatedEvent) {
        if (event.tab.type != CaseTabType.EXTERNAL_PLUGIN) return
        upsertSideRow(event.tab)
    }

    /**
     * On update, re-point the side row to the (possibly changed) configuration/bundle in the tab's
     * `contentKey`. `save` merges by the composite id, so it covers both an unchanged and a changed
     * `contentKey`. If the tab's type changed away from `EXTERNAL_PLUGIN`, drop any stale side row.
     */
    @EventListener(CaseTabUpdatedEvent::class)
    fun handleCaseTabUpdatedEvent(event: CaseTabUpdatedEvent) {
        if (event.tab.type == CaseTabType.EXTERNAL_PLUGIN) {
            upsertSideRow(event.tab)
        } else {
            caseExternalPluginTabRepository.findByIdOrNull(event.tab.id)
                ?.let { caseExternalPluginTabRepository.delete(it) }
        }
    }

    private fun upsertSideRow(tab: CaseTab) {
        val (configurationId, bundleKey) = parseContentKey(tab.contentKey)
        caseExternalPluginTabRepository.save(
            CaseExternalPluginTab(
                id = tab.id,
                externalPluginConfigurationId = configurationId,
                bundleKey = bundleKey,
            )
        )
    }

    @Transactional
    fun getExternalPluginTab(documentId: UUID, tabKey: String): ExternalPluginTabContentDto? {
        val document = runWithoutAuthorization {
            documentService.findByOrNull(JsonSchemaDocumentId.existingId(documentId))
        } ?: return null
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        checkCaseTabAccess(document as JsonSchemaDocument, tabKey)

        val tab = caseExternalPluginTabRepository.findByIdOrNull(CaseTabId(caseDefinitionId, tabKey))
            ?: return null

        val bundleUrl = resolver.orElse(null)
            ?.resolveBundleUrl(tab.externalPluginConfigurationId, tab.bundleKey)

        return ExternalPluginTabContentDto(
            bundleUrl = bundleUrl,
            configurationId = tab.externalPluginConfigurationId,
            bundleKey = tab.bundleKey,
            context = ExternalPluginTabContext(
                documentId = documentId.toString(),
                caseDefinitionKey = caseDefinitionId.key,
                caseDefinitionVersionTag = caseDefinitionId.versionTag.toString(),
                pluginConfigurationId = tab.externalPluginConfigurationId.toString(),
            ),
        )
    }

    /**
     * Lists case tabs that reference a given external-plugin configuration. Used by the external-plugin
     * delete guard (Phase 2.8) so a configuration backing a live tab cannot be deleted.
     */
    @Transactional(readOnly = true)
    fun findUsagesForConfiguration(configurationId: UUID): List<CaseExternalPluginTabUsage> =
        caseExternalPluginTabRepository.findAllByExternalPluginConfigurationId(configurationId)
            .map { sideRow ->
                val tab = caseTabRepository.findByIdOrNull(sideRow.id)
                CaseExternalPluginTabUsage(
                    configurationId = configurationId,
                    caseDefinitionKey = sideRow.id.caseDefinitionId.key,
                    caseDefinitionVersionTag = sideRow.id.caseDefinitionId.versionTag.toString(),
                    tabKey = sideRow.id.key,
                    tabName = tab?.name,
                )
            }

    private fun checkCaseTabAccess(document: JsonSchemaDocument, tabKey: String) {
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        caseTabRepository.findByIdOrNull(CaseTabId(caseDefinitionId, tabKey))?.let { caseTab ->
            authorizationService.requirePermission(
                EntityAuthorizationRequest(
                    CaseTab::class.java,
                    VIEW,
                    caseTab,
                ).withContext(
                    AuthorizationResourceContext(JsonSchemaDocument::class.java, document)
                )
            )
        }
    }

    private fun parseContentKey(contentKey: String): Pair<UUID, String?> {
        val configPart = contentKey.substringBefore(':')
        val bundlePart = contentKey.substringAfter(':', "").takeIf { it.isNotBlank() }
        return UUID.fromString(configPart) to bundlePart
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}

/**
 * One case tab that references an external-plugin configuration. Mapped to a `PluginUsageDto` by the
 * external-plugin delete guard.
 */
data class CaseExternalPluginTabUsage(
    val configurationId: UUID,
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val tabKey: String,
    val tabName: String?,
)
