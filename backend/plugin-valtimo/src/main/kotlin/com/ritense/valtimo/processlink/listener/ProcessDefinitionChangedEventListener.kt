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

package com.ritense.valtimo.processlink.listener

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.event.ProcessDefinitionDeleted
import com.ritense.valtimo.event.ProcessDefinitionDetached
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/**
 * Rechecks plugin configuration issues when a process definition is removed from a case definition.
 *
 * A recheck triggered by a process link change cannot cover these cases: once the process definition is no
 * longer linked to the case definition, its case definition can no longer be resolved from the process
 * definition id. The case definition is taken from the event instead.
 */
class ProcessDefinitionChangedEventListener(
    private val pluginConfigurationMappingResolvers: List<PluginConfigurationMappingResolver>
) {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onProcessDefinitionDeleted(event: ProcessDefinitionDeleted) {
        recheckIssues(event.blueprintId as? CaseDefinitionId)
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onProcessDefinitionDetached(event: ProcessDefinitionDetached) {
        recheckIssues(event.blueprintId as? CaseDefinitionId)
    }

    private fun recheckIssues(caseDefinitionId: CaseDefinitionId?) {
        if (caseDefinitionId == null) {
            return
        }
        pluginConfigurationMappingResolvers.forEach { resolver ->
            try {
                resolver.recheckIssuesForCaseDefinition(caseDefinitionId)
            } catch (e: Exception) {
                logger.warn(e) { "Could not recheck plugin configuration issues for case definition $caseDefinitionId" }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
