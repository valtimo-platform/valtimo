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
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.logging.withLoggingContext
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.event.DocumentPreDeleteEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class BuildingBlockDocumentPreDeleteListener(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val runtimeService: RuntimeService
) {

    @EventListener(DocumentPreDeleteEvent::class)
    fun handleDocumentPreDeleteEvent(event: DocumentPreDeleteEvent) {
        val instances = buildingBlockInstanceRepository.findAllByCaseDocumentId(event.caseDocumentId)
        if (instances.isEmpty()) {
            return
        }

        withLoggingContext(JsonSchemaDocument::class, event.caseDocumentId) {
            logger.info { "Deleting ${instances.size} building block instance(s) of case ${event.caseDocumentId}" }

            // A building block runs as a called subprocess of the case, and a subprocess' history cannot be
            // removed while the tree it belongs to is still running. End the case's processes first, so the
            // clean-up of every building block document below has nothing running left to trip over.
            deleteProcessInstances(event.caseDocumentId.toString())

            // Deleting a building block's own document removes the instance row with it, and gives the other
            // modules the same clean-up they get for a case: process instances, zaak, index entry, and so on.
            instances.forEach { instance ->
                runWithoutAuthorization {
                    documentService.deleteDocument(JsonSchemaDocumentId.existingId(instance.documentId))
                }
            }
        }
    }

    private fun deleteProcessInstances(businessKey: String) {
        runWithoutAuthorization {
            runtimeService.createProcessInstanceQuery()
                .processInstanceBusinessKey(businessKey)
                .rootProcessInstances()
                .list()
                .forEach {
                    runtimeService.deleteProcessInstance(
                        it.processInstanceId,
                        "Case deleted",
                        true,
                        true,
                        true,
                        false
                    )
                }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
