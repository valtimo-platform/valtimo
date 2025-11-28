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

package com.ritense.iko.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.iko.web.rest.request.IkoSearchFieldCreateRequest
import com.ritense.iko.web.rest.request.IkoSearchFieldUpdateRequest
import com.ritense.iko.web.rest.response.IkoSearchFieldResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
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
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class IkoSearchFieldManagementResource(
    private val service: IkoSearchFieldService,
) {

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field")
    fun getIkoSearchFieldsForManagement(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
    ): ResponseEntity<List<IkoSearchFieldResponse>> {
        val ikoSearchFields = service.findAllSearchFieldsByIkoSeachAction(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
        )
        return ResponseEntity.ok(ikoSearchFields.map { IkoSearchFieldResponse.from(it) })
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field/{key}")
    fun getIkoSearchField(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSearchFieldResponse> {
        val ikoSearchField = service.getByKey(ikoViewKey, ikoSeachActionKey, key)
        return ResponseEntity.ok(IkoSearchFieldResponse.from(ikoSearchField))
    }

    @RunWithoutAuthorization
    @PostMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field/{key}")
    fun createIkoSearchField(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSearchFieldCreateRequest
    ): ResponseEntity<IkoSearchFieldResponse> {
        val existingIkoSearchFields = service.findAllSearchFieldsByIkoSeachAction(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
        )
        val ikoSearchField = service.create(
            ikoViewKey,
            ikoSeachActionKey,
            request.toEntity(ikoViewKey, ikoSeachActionKey, existingIkoSearchFields.maxOfOrNull { it.order + 1 } ?: 0)
        )
        return ResponseEntity.ok(IkoSearchFieldResponse.from(ikoSearchField))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field/{key}")
    fun updateIkoSearchField(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSearchFieldUpdateRequest,
    ): ResponseEntity<IkoSearchFieldResponse> {
        require(request.key == key)
        val existingIkoSearchField = service.findByKey(ikoViewKey, ikoSeachActionKey, key)
        requireNotNull(existingIkoSearchField)
        val ikoSearchField = service.update(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
            searchField = request.toEntity(
                existingIkoSearchField.id,
                ikoViewKey,
                ikoSeachActionKey,
                existingIkoSearchField.order
            )
        )
        return ResponseEntity.ok(IkoSearchFieldResponse.from(ikoSearchField))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field")
    fun updateIkoSearchFieldsOrder(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
        @RequestBody request: List<IkoSearchFieldUpdateRequest>,
    ): ResponseEntity<List<IkoSearchFieldResponse>> {
        val existingIkoSearchFields = service.findAllSearchFieldsByIkoSeachAction(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
        )
        require(request.map { it.key }.toSet() == existingIkoSearchFields.map { it.key }.toSet())
        val ikoSearchFields = request.mapIndexed { index, updatedSearchField ->
            val existingSearchField = existingIkoSearchFields.first { it.key == updatedSearchField.key }
            service.update(
                ikoViewKey = ikoViewKey,
                ikoSeachActionKey = ikoSeachActionKey,
                searchField = existingSearchField.copy(order = index)
            )
        }
        return ResponseEntity.ok(ikoSearchFields.map { IkoSearchFieldResponse.from(it) })
    }

    @RunWithoutAuthorization
    @DeleteMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}/search-field/{key}")
    fun deleteIkoSearchField(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSeachActionKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSearchFieldResponse> {
        service.deleteByKey(ikoViewKey, ikoSeachActionKey, key)
        return ResponseEntity.noContent().build()
    }
}
