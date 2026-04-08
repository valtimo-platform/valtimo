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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.StartableItemType
import com.ritense.document.domain.Document
import com.ritense.valtimo.contract.case_.CaseDefinitionId

interface StartableItemProvider {
    val type: StartableItemType

    fun getStartableItems(
        caseDefinitionId: CaseDefinitionId,
        document: Document? = null
    ): List<StartableItemDto>

    fun createItem(caseDefinitionId: CaseDefinitionId, properties: JsonNode): StartableItemDto

    fun updateItem(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String,
        properties: JsonNode
    ): StartableItemDto {
        deleteItem(caseDefinitionId, itemKey, versionTag)
        return createItem(caseDefinitionId, properties)
    }

    fun deleteItem(caseDefinitionId: CaseDefinitionId, itemKey: String, versionTag: String)

    fun getItemProperties(
        caseDefinitionId: CaseDefinitionId,
        itemKey: String,
        versionTag: String
    ): JsonNode? = null
}
