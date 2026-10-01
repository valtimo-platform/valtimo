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

import com.ritense.case.domain.PinnedItemType
import com.ritense.case.service.PinnedItemService
import com.ritense.case.web.rest.dto.PinnedItemCreateRequestDto
import com.ritense.case.web.rest.dto.PinnedItemReorderRequestDto
import com.ritense.case.web.rest.dto.PinnedItemResponseDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api/v1/pinned-item", produces = [APPLICATION_JSON_UTF8_VALUE])
class PinnedItemResource(
    private val pinnedItemService: PinnedItemService
) {

    @GetMapping
    fun getPinnedItems(): ResponseEntity<List<PinnedItemResponseDto>> {
        val pinnedItems = pinnedItemService.getPinnedItems()
        return ResponseEntity.ok(pinnedItems)
    }

    @PostMapping
    fun pinItem(
        @Valid @RequestBody request: PinnedItemCreateRequestDto
    ): ResponseEntity<Void> {
        pinnedItemService.pinItem(request.itemType, request.itemKey)
        return ResponseEntity.status(HttpStatus.CREATED).build()
    }

    @PutMapping("/order")
    fun reorderItems(
        @Valid @RequestBody request: PinnedItemReorderRequestDto
    ): ResponseEntity<Void> {
        pinnedItemService.reorderItems(request.items.map { it.itemType to it.itemKey })
        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/{itemType}/{itemKey}")
    fun unpinItem(
        @PathVariable itemType: PinnedItemType,
        @PathVariable itemKey: String
    ): ResponseEntity<Void> {
        pinnedItemService.unpinItem(itemType, itemKey)
        return ResponseEntity.noContent().build()
    }
}
