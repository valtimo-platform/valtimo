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

package com.ritense.case_.rest

import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.domain.impl.JsonSchemaDocumentId.existingId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseWidgetTabResource(
    private val caseWidgetService: CaseWidgetService
) {

    @EndpointDescription(
        en = "Get case widget tab",
        nl = "Dossiertabblad met widgets ophalen",
    )
    @GetMapping("/v1/document/{documentId}/widget-tab/{tabKey}")
    fun getCaseWidgetTab(
        @PathVariable documentId: String,
        @PathVariable tabKey: String
    ): ResponseEntity<CaseWidgetTabDto> {
        val widgetTab = caseWidgetService.getWidgetTab(existingId(UUID.fromString(documentId)), tabKey)
        return ResponseEntity.ofNullable(widgetTab)
    }

    @EndpointDescription(
        en = "Get case widget data",
        nl = "Dossierwidgetgegevens ophalen",
    )
    @GetMapping("/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}")
    fun getCaseWidgetData(
        @PathVariable documentId: UUID,
        @PathVariable tabKey: String,
        @PathVariable widgetKey: String,
        @PageableDefault(size = 5) pageable: Pageable
    ): ResponseEntity<Any> {
        val data = caseWidgetService.getCaseWidgetData(documentId, tabKey, widgetKey, pageable)
        return ResponseEntity.ofNullable(data)
    }
}
