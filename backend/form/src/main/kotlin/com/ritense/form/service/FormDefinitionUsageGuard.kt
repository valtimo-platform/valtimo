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
package com.ritense.form.service

import com.ritense.authorization.AuthorizationContext
import com.ritense.form.exception.FormDefinitionInUseException
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.repository.FormProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

open class FormDefinitionUsageGuard(
    private val formDefinitionRepository: FormDefinitionRepository,
    private val formProcessLinkRepository: FormProcessLinkRepository,
    private val operatonProcessService: OperatonProcessService,
    private val formProcessLinkUsageResolver: FormProcessLinkUsageResolver,
) {

    @Transactional(propagation = Propagation.MANDATORY)
    open fun lockAndAssertNotInUse(formDefinitionId: UUID) {
        formDefinitionRepository.findByIdForUpdate(formDefinitionId)
        val processLinks = formProcessLinkRepository.findByFormDefinitionId(formDefinitionId)
        if (processLinks.isNotEmpty()) {
            throw FormDefinitionInUseException(formDefinitionId, formProcessLinkUsageResolver.resolve(processLinks))
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    open fun lockAndAssertNotInUseOutside(caseDefinitionId: CaseDefinitionId, formDefinitionIds: Collection<UUID>) {
        if (formDefinitionIds.isEmpty()) return
        formDefinitionIds.sorted().forEach { formDefinitionRepository.findByIdForUpdate(it) }
        val processLinks = formProcessLinkRepository.findByFormDefinitionIdIn(formDefinitionIds)
        if (processLinks.isEmpty()) return

        val ownProcessDefinitionIds = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.getAllDefinitions(caseDefinitionId).map { it.id }.toSet()
        }
        val externalLinks = processLinks.filter { it.processDefinitionId !in ownProcessDefinitionIds }
        val firstLink = externalLinks.firstOrNull() ?: return
        throw FormDefinitionInUseException(firstLink.formDefinitionId, formProcessLinkUsageResolver.resolve(externalLinks))
    }
}
