/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processlink.domain.ProcessLinksCopiedEvent
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.event.ProcessDefinitionDeployedEvent
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonProcessService.DETACHED_PROCESS_DEFINITION_PREFIX
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.event.EventListener
import java.util.UUID

class CopyProcessLinkOnProcessDeploymentListener(
    private val processLinkRepository: ProcessLinkRepository,
    private val operatonRepositoryService: OperatonRepositoryService,
    private val applicationEventPublisher: ApplicationEventPublisher
) {

    @EventListener(ProcessDefinitionDeployedEvent::class)
    fun copyProcessLinks(event: ProcessDefinitionDeployedEvent) {
        if (event.source.skipProcessLinksCopy == true) {
            return
        }

        val originalProcessDefinitionId = event.source.originalProcessDefinitionId
            ?: event.previousProcessDefinitionId?.takeIf { mayCopyLinksFrom(it, event) }

        if (originalProcessDefinitionId != null) {
            val modelInstance = event.processDefinitionModelInstance

            val newLinks = processLinkRepository.findByProcessDefinitionId(originalProcessDefinitionId)
                .filter { link -> modelInstance.getModelElementById<FlowNode>(link.activityId) != null }
                .filter { link ->
                    processLinkRepository.findByProcessDefinitionIdAndActivityId(
                        event.processDefinitionId,
                        link.activityId
                    ).isEmpty()
                }
                .onEach { link ->
                    logger.debug { "Copying process link from original process with id ${originalProcessDefinitionId} to newly deployed process with id ${event.processDefinitionId}. Activity: '${link.activityId}', type: '${link.processLinkType}'." }
                }.map { link ->
                    link.copy(id = UUID.randomUUID(), processDefinitionId = event.processDefinitionId)
                }

            processLinkRepository.saveAll(newLinks)

            applicationEventPublisher.publishEvent(
                ProcessLinksCopiedEvent(
                    newLinks,
                    event.processDefinitionId,
                    event.caseDefinitionId,
                    event.source.originalProcessDefinitionId,
                    CaseDefinitionId.fromProcessVersionTag(event.source.originalVersionTag),
                )
            )
        }
    }

    /**
     * Whether the links of the key-based predecessor may follow the new deployment.
     *
     * Carrying them forward is right within one blueprint — a new version of a process keeps its links —
     * and wrong *between* blueprints, which is the leak this guard exists for: a building block's links
     * landing on the deployment of a case definition that happens to use the same process definition key.
     *
     * The rule is deliberately **asymmetric**. A blueprint's links may follow onto a deployment that
     * belongs to **no** blueprint, because the two are not competing owners: an unblueprinted deployment
     * of the same key is the same process, deployed once more outside a case or building block, and
     * several lookups resolve a process purely by key — `byKeyOfUnlinkedProcess` for a start form, and
     * key-plus-latest-version for a user task. Refusing that copy leaves those lookups pointing at a
     * deployment with no links at all, which is what broke `FormViewModelResourceIntTest`. What stays
     * refused is a copy *into* a blueprint from anywhere it does not own: another case definition, a
     * building block, or a process with no blueprint at all.
     */
    private fun mayCopyLinksFrom(
        previousProcessDefinitionId: String,
        event: ProcessDefinitionDeployedEvent
    ): Boolean {
        val previousVersionTag = runWithoutAuthorization {
            operatonRepositoryService.findProcessDefinitionById(previousProcessDefinitionId)
        }?.versionTag
        val previousOwner = owningBlueprintOf(previousVersionTag)
        val owner = owningBlueprintOf(event.versionTag)

        if (owner == null) {
            return true // nothing claims the new deployment, so nothing is being taken from its owner
        }
        if (previousOwner != owner) {
            logger.debug {
                "Not copying process links from process with id $previousProcessDefinitionId to newly deployed " +
                    "process with id ${event.processDefinitionId}. The previous version of process " +
                    "'${event.processDefinitionKey}' is owned by ${previousOwner ?: "no blueprint"}, " +
                    "the newly deployed version by ${owner ?: "no blueprint"}."
            }
            return false
        }
        return true
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        internal fun owningBlueprintOf(versionTag: String?): String? {
            val tag = versionTag?.removePrefix(DETACHED_PROCESS_DEFINITION_PREFIX) ?: return null

            return BuildingBlockDefinitionId.fromProcessVersionTag(tag)?.let { "${it.getTagPrefix()}${it.key}" }
                ?: CaseDefinitionId.fromProcessVersionTag(tag)?.let { "${it.getTagPrefix()}${it.key}" }
        }
    }
}
