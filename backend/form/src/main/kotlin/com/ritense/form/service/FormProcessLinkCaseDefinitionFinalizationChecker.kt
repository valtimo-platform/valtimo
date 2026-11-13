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
import com.ritense.case.service.finalization.CaseDefinitionFinalizationCheckResult
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.form.repository.FormProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService

class FormProcessLinkCaseDefinitionFinalizationChecker(
    private val operatonProcessService: OperatonProcessService,
    private val formProcessLinkRepository: FormProcessLinkRepository,
) : CaseDefinitionFinalizationChecker {

    override fun check(caseDefinitionId: CaseDefinitionId): CaseDefinitionFinalizationCheckResult {
        val processDefinitionIds = AuthorizationContext.runWithoutAuthorization {
            operatonProcessService.getAllDefinitions(caseDefinitionId).map { it.id }
        }
        val hasMissingForm = processDefinitionIds.isNotEmpty() &&
            formProcessLinkRepository.existsDanglingByProcessDefinitionIdIn(processDefinitionIds)

        return if (hasMissingForm) {
            CaseDefinitionFinalizationCheckResult(false, "PROCESS_LINK_FORM_MISSING")
        } else {
            CaseDefinitionFinalizationCheckResult(true)
        }
    }
}
