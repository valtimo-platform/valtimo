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

package com.ritense.case_.widget.fieldsheader

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.convertValue
import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.case_.widget.fields.FieldsWidgetProperties
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID
import org.springframework.data.domain.Pageable

class FieldsCaseHeaderWidgetDataProvider(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is CaseHeaderWidget && widget.type == "fields"

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): Any {
        widget as CaseHeaderWidget
        val properties = objectMapper.convertValue<FieldsWidgetProperties>(widget.properties)

        val valueKeyMap = properties.columns
            .flatMap { column -> column.map { field -> field.value to field.key } }
            .toMap()

        val resolvedValues = valueResolverService.resolveValues(
            mapOf(DOCUMENT_ID to documentId.toString(), PAGEABLE to pageable),
            valueKeyMap.keys
        )

        return properties.columns
            .flatMap { column -> column.map { field -> field.key to (resolvedValues[field.value] ?: null) } }
            .toMap()
    }
}
