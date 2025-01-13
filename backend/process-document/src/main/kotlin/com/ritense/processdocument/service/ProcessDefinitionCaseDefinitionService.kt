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
package com.ritense.processdocument.service

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.ProcessDocumentDefinitionRequest
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId

class ProcessDefinitionCaseDefinitionService(
    private val authorizationService: AuthorizationService,
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository
) {
    fun findById(id: ProcessDefinitionCaseDefinitionId): ProcessDefinitionCaseDefinition? {
        return processDefinitionCaseDefinitionRepository.findById(id).orElse(null)
    }

    fun findByProcessDefinitionId(processDefinitionId: ProcessDefinitionId): ProcessDefinitionCaseDefinition {
        return processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(processDefinitionId)
    }

    fun findProcessDocumentDefinitions(caseDefinitionId: CaseDefinitionId): List<ProcessDefinitionCaseDefinition> {
        return processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(caseDefinitionId)
    }

    fun deleteProcessDocumentDefinition(request: ProcessDocumentDefinitionRequest) {
        denyAuthorization()
        val id = ProcessDefinitionCaseDefinitionId(
            ProcessDefinitionId(request.processDefinitionId),
            request.caseDefinitionId
        )

        processDefinitionCaseDefinitionRepository.deleteById(id)
    }

    fun createProcessDocumentDefinition(request: ProcessDocumentDefinitionRequest) {
        denyAuthorization()

        val processDocumentDefinition = ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                ProcessDefinitionId(request.processDefinitionId),
                request.caseDefinitionId
            ),
            canInitializeDocument = request.canInitializeDocument,
            startableByUser = request.startableByUser
        )

        processDefinitionCaseDefinitionRepository.save(processDocumentDefinition)
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                ProcessDefinitionCaseDefinition::class.java,
                Action.deny()
            )
        )
    }
}
