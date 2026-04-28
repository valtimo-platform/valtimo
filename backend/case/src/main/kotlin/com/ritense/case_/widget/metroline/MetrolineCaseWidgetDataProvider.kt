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

package com.ritense.case_.widget.metroline

import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.document.repository.InternalCaseStatusHistoryRepository
import com.ritense.document.service.InternalCaseStatusService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.domain.Pageable
import java.util.UUID

class MetrolineCaseWidgetDataProvider(
    private val internalCaseStatusService: InternalCaseStatusService,
    private val internalCaseStatusHistoryRepository: InternalCaseStatusHistoryRepository,
    private val zaakMetrolineDataService: ZaakMetrolineDataService?,
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is MetrolineCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId,
    ): List<MetrolineItem> {
        widget as MetrolineCaseWidget
        return when (widget.properties.mode) {
            MetrolineMode.INTERNAL_CASE_STATUS -> getInternalCaseStatusItems(documentId, caseDefinitionId)
            MetrolineMode.ZAAKSTATUS -> getZaakstatusItems(documentId)
        }
    }

    private fun getInternalCaseStatusItems(
        documentId: UUID,
        caseDefinitionId: CaseDefinitionId,
    ): List<MetrolineItem> {
        val history = internalCaseStatusHistoryRepository.findByDocumentIdOrderByCreatedOn(documentId)
        val statusKeys = history.map { it.internalCaseStatusKey }

        val statusesByKey = internalCaseStatusService.getInternalCaseStatuses(caseDefinitionId.key)
            .associateBy { it.id.key }

        return statusKeys.map { key ->
            val status = statusesByKey[key]
            MetrolineItem(
                title = status?.title ?: key,
                label = status?.label,
                completed = true,
            )
        }
    }

    private fun getZaakstatusItems(documentId: UUID): List<MetrolineItem> {
        return zaakMetrolineDataService?.getMetrolineItems(documentId)
            ?: throw IllegalStateException(
                "Zaakstatus metroline mode requires the zaken-api module to be present on the classpath."
            )
    }
}
