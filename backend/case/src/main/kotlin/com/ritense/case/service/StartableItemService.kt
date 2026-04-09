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

package com.ritense.case.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.repository.StartableItemRepository
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.util.UUID
import org.semver4j.Semver
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@SkipComponentScan
@Service
class StartableItemService(
    private val startableItemProviders: List<StartableItemProvider>,
    private val startableItemRepository: StartableItemRepository,
    private val documentService: DocumentService,
    private val caseDefinitionService: CaseDefinitionService,
) {

    @Transactional(readOnly = true)
    fun getStartableItems(
        caseDocumentId: UUID? = null,
        caseDefinitionKey: String? = null,
        caseDefinitionVersionTag: String? = null
    ): List<StartableItemDto> {
        val document = caseDocumentId?.let {
            runWithoutAuthorization { documentService.get(caseDocumentId.toString()) }
        }

        val caseDefinitionId = if (document != null) {
            document.definitionId().caseDefinitionId()
        } else if (caseDefinitionKey != null && caseDefinitionVersionTag != null) {
            CaseDefinitionId(caseDefinitionKey, Semver(caseDefinitionVersionTag))
        } else if (caseDefinitionKey != null) {
            caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)?.id ?: return emptyList()
        } else {
            return emptyList()
        }

        val allItems = startableItemProviders.flatMap { provider ->
            provider.getStartableItems(caseDefinitionId, document)
        }

        val sortOrderMap = startableItemRepository
            .findAllByIdCaseDefinitionId(caseDefinitionId)
            .associate { (it.id.itemKey to it.id.itemType) to it.sortOrder }

        return allItems.sortedWith(compareBy(
            { sortOrderMap[it.key to it.type] ?: Int.MAX_VALUE },
            { it.name ?: it.key }
        ))
    }
}
