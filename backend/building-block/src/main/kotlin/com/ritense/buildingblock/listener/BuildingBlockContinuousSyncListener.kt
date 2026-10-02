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

package com.ritense.buildingblock.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.document.domain.event.DocumentModifiedEvent
import com.ritense.document.service.DocumentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valueresolver.ValueResolverService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * Continuously syncs building block output mappings with [BuildingBlockSyncTiming.CONTINUOUS] to the
 * parent context on every committed write to the building block document. Mappings with
 * [BuildingBlockSyncTiming.END] are synced on completion by
 * [com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener] (call activity)
 * and [BuildingBlockEndEventListener] (ad-hoc).
 */
@Component
@SkipComponentScan
class BuildingBlockContinuousSyncListener(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val processLinkService: ProcessLinkService,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val documentService: DocumentService,
    private val valueResolverService: ValueResolverService,
    private val runtimeService: RuntimeService,
) {

    @EventListener(DocumentModifiedEvent::class)
    fun onDocumentModified(event: DocumentModifiedEvent) {
        val buildingBlockInstance = buildingBlockInstanceService.getByDocumentId(event.documentId().id)
            ?: return

        if (buildingBlockInstance.callerProcessDefinitionId != null) {
            syncCallActivityBuildingBlock(buildingBlockInstance)
        } else {
            syncAdHocBuildingBlock(buildingBlockInstance)
        }
    }

    private fun syncCallActivityBuildingBlock(buildingBlockInstance: BuildingBlockInstance) {
        val activityId = buildingBlockInstance.activityId ?: return
        val processLink = processLinkService.getProcessLinks(
            buildingBlockInstance.callerProcessDefinitionId!!,
            activityId
        ).filterIsInstance<BuildingBlockProcessLink>().singleOrNull()
            ?: return

        val continuousMappings = processLink.outputMappings
            .filter { it.syncTiming == BuildingBlockSyncTiming.CONTINUOUS }
        if (continuousMappings.isEmpty()) return

        logger.debug { "Continuously syncing output mappings of building block document '${buildingBlockInstance.documentId}'" }
        val valuesToHandle = resolveOutputValues(buildingBlockInstance, continuousMappings)

        // Separate process variable targets (pv:) from other targets (doc:, case:, etc.)
        val pvTargets = valuesToHandle.filterKeys { it.startsWith(PV_PREFIX) }
        val otherTargets = valuesToHandle.filterKeys { !it.startsWith(PV_PREFIX) }

        if (pvTargets.isNotEmpty()) {
            val callerProcessInstanceId = findCallerProcessInstanceId(buildingBlockInstance)
            if (callerProcessInstanceId != null) {
                runWithoutAuthorization {
                    valueResolverService.handleValues(callerProcessInstanceId, null, pvTargets)
                }
            } else {
                logger.debug {
                    "Skipping continuous sync of process variable targets for building block document " +
                        "'${buildingBlockInstance.documentId}': caller process instance not found"
                }
            }
        }

        if (otherTargets.isNotEmpty()) {
            val parentId = buildingBlockInstance.parentBuildingBlockInstanceId
            val targetDocumentId = if (parentId != null) {
                val parentInstance = buildingBlockInstanceService.get(parentId)
                    ?: throw IllegalStateException("Parent building block instance not found: $parentId")
                parentInstance.documentId
            } else {
                buildingBlockInstance.caseDocumentId
                    ?: throw IllegalStateException(
                        "Cannot write doc: output mappings for building block without a case document"
                    )
            }
            runWithoutAuthorization {
                valueResolverService.handleValues(targetDocumentId, otherTargets)
            }
        }
    }

    private fun syncAdHocBuildingBlock(buildingBlockInstance: BuildingBlockInstance) {
        val caseDocumentId = buildingBlockInstance.caseDocumentId ?: return
        val caseDocument = runWithoutAuthorization { documentService.get(caseDocumentId.toString()) }
        val caseDefinitionId = caseDocument.definitionId().caseDefinitionId()
        val link = caseDefinitionBuildingBlockLinkService.findLink(caseDefinitionId, buildingBlockInstance.definition.id)
            ?: return

        val continuousMappings = link.outputMappings
            .filter { it.syncTiming == BuildingBlockSyncTiming.CONTINUOUS }
        if (continuousMappings.isEmpty()) return

        val valuesToHandle = resolveOutputValues(buildingBlockInstance, continuousMappings)
        if (valuesToHandle.isEmpty()) return

        logger.debug {
            "Continuously syncing output mappings of ad-hoc building block document " +
                "'${buildingBlockInstance.documentId}' to case '$caseDefinitionId'"
        }
        runWithoutAuthorization {
            valueResolverService.handleValues(caseDocumentId, valuesToHandle)
        }
    }

    /**
     * Resolves the sources of [mappings] against the building block document and maps them to their targets.
     * Sources that resolve to `null` (not yet produced by the still-running building block) are skipped: writing
     * a JSON null back to a typed parent field would fail schema validation and abort the triggering write.
     * The value is synced on a later modification, once the source has actually been set.
     */
    private fun resolveOutputValues(
        buildingBlockInstance: BuildingBlockInstance,
        mappings: List<BuildingBlockOutputMapping>
    ): Map<String, Any?> {
        val resolvedValues = runWithoutAuthorization {
            valueResolverService.resolveValues(
                buildingBlockInstance.documentId.toString(),
                mappings.map { it.getPrefixedSource() }
            )
        }
        return mappings.mapNotNull { mapping ->
            resolvedValues[mapping.getPrefixedSource()]?.let { mapping.target to it }
        }.toMap()
    }

    private fun findCallerProcessInstanceId(buildingBlockInstance: BuildingBlockInstance): String? {
        val buildingBlockProcessInstanceId = buildingBlockInstance.processInstanceId ?: return null
        return runtimeService.createProcessInstanceQuery()
            .subProcessInstanceId(buildingBlockProcessInstanceId)
            .singleResult()
            ?.id
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
        private const val PV_PREFIX = "pv:"
    }
}
