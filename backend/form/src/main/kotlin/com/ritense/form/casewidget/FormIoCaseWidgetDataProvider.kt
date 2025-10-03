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

package com.ritense.form.casewidget

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.form.service.FormDefinitionService
import com.ritense.form.service.PrefillFormService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.domain.Pageable
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

class FormIoCaseWidgetDataProvider(
    private val formDefinitionService: FormDefinitionService,
    private val formService: PrefillFormService
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean =
        widget is FormIoCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): JsonNode? {
        widget as FormIoCaseWidget
        val formDefinition = formDefinitionService.getFormDefinitionByName(
            widget.properties.formDefinitionName,
            caseDefinitionId
        ).getOrNull()

        return formDefinition?.let {
            formService.getPrefilledFormDefinition(it.id, documentId).asJson()
        }
    }
}