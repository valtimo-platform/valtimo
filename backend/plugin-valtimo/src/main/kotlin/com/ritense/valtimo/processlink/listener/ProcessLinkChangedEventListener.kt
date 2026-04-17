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

import com.ritense.processlink.event.ProcessLinkCreatedEvent
import com.ritense.processlink.event.ProcessLinkDeletedEvent
import com.ritense.processlink.event.ProcessLinkUpdatedEvent
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

class ProcessLinkChangedEventListener(
    private val pluginConfigurationMappingResolver: PluginConfigurationMappingResolver
) {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onProcessLinkCreated(event: ProcessLinkCreatedEvent) {
        recheckIssues(event.processDefinitionId)
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onProcessLinkUpdated(event: ProcessLinkUpdatedEvent) {
        recheckIssues(event.processDefinitionId)
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onProcessLinkDeleted(event: ProcessLinkDeletedEvent) {
        recheckIssues(event.processDefinitionId)
    }

    private fun recheckIssues(processDefinitionId: String) {
        try {
            pluginConfigurationMappingResolver.recheckIssuesForProcessDefinition(processDefinitionId)
        } catch (e: Exception) {
            logger.debug(e) { "Could not recheck plugin configuration issues for process definition $processDefinitionId" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
