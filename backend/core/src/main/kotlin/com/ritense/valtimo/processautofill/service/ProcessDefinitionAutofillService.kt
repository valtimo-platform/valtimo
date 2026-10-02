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

package com.ritense.valtimo.processautofill.service

import com.ritense.valtimo.processautofill.domain.AutofillModificationType
import com.ritense.valtimo.processautofill.domain.ProcessDefinitionAutofill
import com.ritense.valtimo.processautofill.repository.ProcessDefinitionAutofillRepository
import org.springframework.transaction.annotation.Transactional

@Transactional
class ProcessDefinitionAutofillService(
    private val processDefinitionAutofillRepository: ProcessDefinitionAutofillRepository
) {

    @Transactional(readOnly = true)
    fun findByProcessDefinitionId(processDefinitionId: String): List<ProcessDefinitionAutofill> {
        return processDefinitionAutofillRepository.findByProcessDefinitionId(processDefinitionId)
    }

    fun saveAutofillRecords(
        processDefinitionId: String,
        modifications: List<AutofillModification>
    ) {
        processDefinitionAutofillRepository.deleteByProcessDefinitionId(processDefinitionId)

        val records = modifications.map { modification ->
            ProcessDefinitionAutofill(
                processDefinitionId = processDefinitionId,
                activityId = modification.activityId,
                modificationType = modification.modificationType,
                appliedValue = modification.appliedValue
            )
        }

        processDefinitionAutofillRepository.saveAll(records)
    }

    fun deleteByProcessDefinitionIdAndActivityId(processDefinitionId: String, activityId: String) {
        processDefinitionAutofillRepository.deleteByProcessDefinitionIdAndActivityId(
            processDefinitionId, activityId
        )
    }
}

data class AutofillModification(
    val activityId: String,
    val modificationType: AutofillModificationType,
    val appliedValue: String
)
