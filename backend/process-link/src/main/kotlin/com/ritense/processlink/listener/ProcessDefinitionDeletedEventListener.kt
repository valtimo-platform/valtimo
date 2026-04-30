/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.processlink.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.event.ProcessDefinitionDeleted
import com.ritense.valtimo.event.ProcessDefinitionDetached
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Transactional
@Component
@SkipComponentScan
class ProcessDefinitionDeletedEventListener(
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val processLinkService: ProcessLinkService,
) {

    @RunWithoutAuthorization
    @EventListener(ProcessDefinitionDeleted::class)
    fun handleProcessDefinitionDeletedEvent(event: ProcessDefinitionDeleted) {
        if (event.blueprintId != null) {
            if (OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX == event.blueprintId?.getTagPrefix()) {
                processDefinitionCaseDefinitionService.deleteProcessDefinitionCaseDefinition(
                    ProcessDefinitionId(event.processDefinitionId),
                    event.blueprintId!! as CaseDefinitionId
                )
            } else if (OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX == event.blueprintId?.getTagPrefix()) {
                // TODO: how do we handle building blocks being deleted?
            } else {
                // TODO Do we need to react on something still?
            }

        }
        processLinkService.deleteProcessLinksForProcessDefinition(event.processDefinitionId)
    }

    @RunWithoutAuthorization
    @EventListener(ProcessDefinitionDetached::class)
    fun handleProcessDefinitionDetachedEvent(event: ProcessDefinitionDetached) {
        if (event.blueprintId != null && event.blueprintId is CaseDefinitionId) {
            processDefinitionCaseDefinitionService.deleteProcessDefinitionCaseDefinition(
                ProcessDefinitionId(event.processDefinitionId),
                event.blueprintId!! as CaseDefinitionId
            )
        }
    }
}