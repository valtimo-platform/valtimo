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

package com.ritense.case.web.rest

import com.ritense.case.service.StartableItemService
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import java.util.UUID
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/case", produces = [APPLICATION_JSON_UTF8_VALUE])
class StartableItemResource(
    private val startableItemService: StartableItemService,
) {

    @EndpointDescription(
        en = "List startable items",
        nl = "Startbare items ophalen",
    )
    @GetMapping("/startable-item")
    fun getStartableItems(
        @RequestParam(required = false) caseDocumentId: UUID?,
        @RequestParam(required = false) caseDefinitionKey: String?,
        @RequestParam(required = false) caseDefinitionVersionTag: String?,
    ): ResponseEntity<List<StartableItemDto>> {
        require(caseDocumentId != null || caseDefinitionKey != null) {
            "Either caseDocumentId or caseDefinitionKey must be provided"
        }
        val items = startableItemService.getStartableItems(
            caseDocumentId = caseDocumentId,
            caseDefinitionKey = caseDefinitionKey,
            caseDefinitionVersionTag = caseDefinitionVersionTag
        )
        return ResponseEntity.ok(items)
    }
}
