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

package com.ritense.case_.rest

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.rest.dto.CaseHeaderWidgetDto
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseHeaderWidgetResource(
    private val caseHeaderWidgetService: CaseHeaderWidgetService,
    private val documentService: DocumentService,
    private val caseWidgetService: CaseWidgetService
) {

    @GetMapping("/v1/case/{documentId}/header-widget")
    fun getCaseHeaderWidget(
        @PathVariable documentId: String
    ): ResponseEntity<CaseHeaderWidgetDto> {
        val document = documentService.get(documentId)
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        val id = CaseDefinitionId(caseDefinitionId.key, caseDefinitionId.versionTag.toString())
        val widget = runWithoutAuthorization {
            caseHeaderWidgetService.findById(id)
        }

        return if (widget != null) {
            ResponseEntity.ok(widget)
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @GetMapping("/v1/case/{documentId}/header-widget/data")
    fun getCaseHeaderWidgetData(
        @PathVariable documentId: UUID,
        @PageableDefault(size = 5) pageable: Pageable
    ): ResponseEntity<Any> {
        val document = documentService.get(documentId.toString())
        val caseDefinitionId = document.definitionId().caseDefinitionId()
        val id = CaseDefinitionId(caseDefinitionId.key, caseDefinitionId.versionTag.toString())
        val widgetDto = runWithoutAuthorization { caseHeaderWidgetService.findById(id) } ?: return ResponseEntity.notFound().build()
        val widget = CaseHeaderWidget(
            id = id,
            type = widgetDto.type,
            highContrast = widgetDto.highContrast,
            properties = widgetDto.properties
        )
        val data = caseWidgetService.getCaseHeaderWidgetData(document, widget, pageable, caseDefinitionId)
        return ResponseEntity.ofNullable(data)
    }
}