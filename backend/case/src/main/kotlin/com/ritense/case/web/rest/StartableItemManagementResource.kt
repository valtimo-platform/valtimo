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

import com.ritense.case.service.StartableItemManagementService
import com.ritense.case.web.rest.dto.CreateStartableItemRequest
import com.ritense.case.web.rest.dto.ManagementStartableItemDto
import com.ritense.case.web.rest.dto.StartableItemDto
import com.ritense.case.web.rest.dto.UpdateStartableItemOrderRequest
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping(
    "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item",
    produces = [APPLICATION_JSON_UTF8_VALUE]
)
class StartableItemManagementResource(
    private val startableItemManagementService: StartableItemManagementService,
) {

    @GetMapping
    fun getStartableItems(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String
    ): ResponseEntity<List<ManagementStartableItemDto>> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(startableItemManagementService.getStartableItems(caseDefinitionId))
    }

    @PostMapping
    fun createStartableItem(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestBody request: CreateStartableItemRequest
    ): ResponseEntity<StartableItemDto> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val item = startableItemManagementService.createItem(
            caseDefinitionId,
            request.type,
            request.properties
        )
        return ResponseEntity.ok(item)
    }

    @DeleteMapping("/{itemKey}/version/{versionTag}")
    fun deleteStartableItem(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable itemKey: String,
        @PathVariable versionTag: String
    ): ResponseEntity<Void> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        startableItemManagementService.deleteItem(caseDefinitionId, itemKey, versionTag)
        return ResponseEntity.noContent().build()
    }

    @PutMapping("/order")
    fun updateOrder(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestBody request: UpdateStartableItemOrderRequest
    ): ResponseEntity<List<ManagementStartableItemDto>> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(startableItemManagementService.updateOrder(caseDefinitionId, request.items))
    }
}
