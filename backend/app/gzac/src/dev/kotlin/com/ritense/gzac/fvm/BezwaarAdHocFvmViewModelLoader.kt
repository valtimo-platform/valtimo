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

package com.ritense.gzac.fvm

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.service.impl.FormIoFormDefinitionService
import com.ritense.formviewmodel.viewmodel.ViewModelLoader
import com.ritense.processlink.domain.ProcessLink
import com.ritense.valtimo.operaton.domain.OperatonTask
import org.springframework.stereotype.Component

@Component
class BezwaarAdHocFvmViewModelLoader(
    private val formIoFormDefinitionService: FormIoFormDefinitionService
) : ViewModelLoader<BezwaarAdHocFvmViewModel> {

    override fun supports(processLink: ProcessLink): Boolean {
        if (processLink !is FormProcessLink) return false
        val formName = formIoFormDefinitionService.getFormDefinitionById(processLink.formDefinitionId)
            .orElse(null)?.name
        return formName in FORM_NAMES
    }

    override fun load(task: OperatonTask?, document: JsonSchemaDocument?): BezwaarAdHocFvmViewModel {
        if (task != null) {
            val omschrijving = task.execution?.getVariable("omschrijving") as? String
            val toelichting = task.execution?.getVariable("toelichting") as? String
            return BezwaarAdHocFvmViewModel(
                omschrijving = omschrijving ?: "Geen omschrijving",
                toelichting = toelichting ?: "Geen toelichting",
                beoordeling = "Vooringevuld door FVM ViewModelLoader (user task)"
            )
        }
        return BezwaarAdHocFvmViewModel(
            omschrijving = "Bezwaar tegen besluit - vooringevuld door FVM",
            toelichting = "Dit formulier is vooringevuld via het Form View Model (FVM) mechanisme. " +
                "De ViewModelLoader heeft deze waarden gezet op basis van backend logica."
        )
    }

    companion object {
        private val FORM_NAMES = setOf("bezwaar-ad-hoc-fvm-start", "bezwaar-ad-hoc-fvm-task")
    }
}
