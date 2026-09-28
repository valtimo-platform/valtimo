/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.search.web.rest

import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.web.rest.dto.SearchFieldV2Dto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
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
@RequestMapping("/api/v1/search/field", produces = [APPLICATION_JSON_UTF8_VALUE])
class SearchFieldV2Resource(
    private val searchFieldV2Service: SearchFieldV2Service
) {

    @EndpointDescription(
        en = "Create search field",
        nl = "Zoekveld aanmaken",
    )
    @PostMapping("/{ownerId}")
    fun create(
        @PathVariable ownerId: String,
        @Valid @RequestBody searchFieldV2Dto: SearchFieldV2Dto
    ) =
        ResponseEntity.ok(searchFieldV2Service.create(searchFieldV2Dto))

    @EndpointDescription(
        en = "Update search field by key",
        nl = "Zoekveld bijwerken op sleutel",
    )
    @PutMapping("/{ownerId}/{key}")
    fun update(
        @PathVariable ownerId: String,
        @PathVariable key: String,
        @Valid @RequestBody searchFieldV2Dto: SearchFieldV2Dto
    ) =
        ResponseEntity.ok(searchFieldV2Service.update(searchFieldV2Dto))

    @EndpointDescription(
        en = "Update search field list",
        nl = "Lijst met zoekvelden bijwerken",
    )
    @PutMapping("/{ownerId}/fields")
    fun updateList(
        @PathVariable ownerId: String,
        @Valid @RequestBody searchFieldV2Dtos: List<SearchFieldV2Dto>
    ) =
        ResponseEntity.ok(searchFieldV2Service.updateList(ownerId, searchFieldV2Dtos))

    @EndpointDescription(
        en = "List search fields by owner",
        nl = "Zoekvelden ophalen per eigenaar",
    )
    @Deprecated("Since 12.1.0")
    @GetMapping("/{ownerId}")
    fun getAllByOwnerId(@PathVariable ownerId: String) =
        ResponseEntity.ok(searchFieldV2Service.findAllByOwnerId(ownerId))

    @EndpointDescription(
        en = "List search fields by owner type and id",
        nl = "Zoekvelden ophalen per eigenaartype en id",
    )
    @GetMapping("/{ownerType}/{ownerId}")
    fun getAllByOwnerTypeAndOwnerId(@PathVariable ownerType: String, @PathVariable ownerId: String) =
        ResponseEntity.ok(searchFieldV2Service.findAllByOwnerTypeAndOwnerId(ownerType, ownerId))

    @EndpointDescription(
        en = "Delete search field by key",
        nl = "Zoekveld verwijderen op sleutel",
    )
    @Deprecated("Since 12.1.0")
    @DeleteMapping("/{ownerId}/{key}")
    fun delete(
        @PathVariable ownerId: String,
        @PathVariable key: String
    ): ResponseEntity<Any> {
        searchFieldV2Service.delete(ownerId, key)
        return ResponseEntity.noContent().build()
    }

    @EndpointDescription(
        en = "Delete search field by owner type and key",
        nl = "Zoekveld verwijderen op eigenaartype en sleutel",
    )
    @DeleteMapping("/{ownerType}/{ownerId}/{key}")
    fun delete(
        @PathVariable ownerType: String,
        @PathVariable ownerId: String,
        @PathVariable key: String
    ): ResponseEntity<Any> {
        searchFieldV2Service.delete(ownerType, ownerId, key)
        return ResponseEntity.noContent().build()
    }
}
