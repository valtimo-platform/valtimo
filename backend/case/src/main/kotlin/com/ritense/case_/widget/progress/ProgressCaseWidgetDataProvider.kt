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

package com.ritense.case_.widget.progress

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.InternalCaseStatusRepository
import com.ritense.document.service.DocumentService
import com.ritense.document.service.findByOrNull
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.domain.Pageable
import java.util.UUID

class ProgressCaseWidgetDataProvider(
    private val documentService: DocumentService,
    private val internalCaseStatusRepository: InternalCaseStatusRepository,
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is ProgressCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): ProgressCaseWidgetData {
        val document: Document? = runWithoutAuthorization {
            documentService.findByOrNull(JsonSchemaDocumentId.existingId(documentId))
        }
        val currentStatusKey: String? = document?.internalStatus()

        val statuses = runWithoutAuthorization {
            internalCaseStatusRepository.findByIdCaseDefinitionKeyOrderByOrder(caseDefinitionId.key)
        }

        val steps = statuses.map { status ->
            ProgressStep(
                key = status.id.key,
                title = status.title,
                order = status.order,
            )
        }

        val currentIndex = if (currentStatusKey != null) {
            steps.indexOfFirst { it.key == currentStatusKey }.takeIf { it >= 0 } ?: 0
        } else {
            0
        }

        return ProgressCaseWidgetData(
            steps = steps,
            currentStepIndex = currentIndex,
        )
    }
}

data class ProgressCaseWidgetData(
    val steps: List<ProgressStep>,
    val currentStepIndex: Int,
)

data class ProgressStep(
    val key: String,
    val title: String,
    val order: Int,
)
