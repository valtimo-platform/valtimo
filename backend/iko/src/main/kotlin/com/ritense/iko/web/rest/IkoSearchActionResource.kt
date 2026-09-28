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

import com.ritense.iko.service.IkoListColumnService
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.iko.web.rest.request.IkoSearchRequest
import com.ritense.iko.web.rest.response.IkoSearchActionUserListResponse
import com.ritense.iko.web.rest.response.IkoSearchResponse
import com.ritense.search.domain.SearchFieldV2
import com.ritense.search.domain.SearchListColumn
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.contract.iko.DataFilter
import jakarta.validation.Valid
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class IkoSearchActionResource(
    private val ikoSearchActionService: IkoSearchActionService,
    private val ikoListColumnService: IkoListColumnService,
    private val ikoSearchFieldService: IkoSearchFieldService,
) {

    @EndpointDescription(
        en = "List IKO search actions",
        nl = "IKO-zoekacties ophalen",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/search-action")
    fun getIkoSearchActions(
        @PathVariable ikoViewKey: String,
    ): ResponseEntity<List<IkoSearchActionUserListResponse>> {
        val ikoSearchActions = ikoSearchActionService.findAll(
            ikoViewKey = ikoViewKey,
        )
        val response = ikoSearchActions.map { ikoSearchAction ->
            val searchFields =
                ikoSearchFieldService.findAllSearchFieldsByIkoSearchAction(ikoViewKey, ikoSearchAction.id.key)
            IkoSearchActionUserListResponse.from(ikoSearchAction, searchFields)
        }
        return ResponseEntity.ok(response)
    }

    @EndpointDescription(
        en = "Execute IKO search action",
        nl = "IKO-zoekactie uitvoeren",
    )
    @PostMapping("/v1/iko-view/{ikoViewKey}/search-action/{ikoSearchActionKey}/search")
    fun search(
        @PathVariable ikoViewKey: String,
        @PathVariable ikoSearchActionKey: String,
        @Valid @RequestBody request: IkoSearchRequest,
        pageable: Pageable,
    ): ResponseEntity<IkoSearchResponse> {
        val headers = ikoListColumnService.findAllColumnsByIkoViewKey(ikoViewKey)
        val searchFields =
            ikoSearchFieldService.findAllSearchFieldsByIkoSearchAction(ikoViewKey, ikoSearchActionKey)
        require(searchFields.filter { it.required }.all { request.filters.containsKey(it.key) }) {
            "Missing required SearchField for IkoSearchAction '$ikoViewKey:$ikoSearchActionKey'"
        }
        val data = ikoSearchActionService.searchData(
            key = ikoSearchActionKey,
            ikoViewKey = ikoViewKey,
            filters = toDataFilers(request.filters, searchFields),
            pageable = toPageableByPath(headers, pageable),
        )
        return ResponseEntity.ok(IkoSearchResponse.from(headers, data))
    }

    private fun toDataFilers(filters: Map<String, Any?>, searchFields: List<SearchFieldV2>): List<DataFilter> {
        return filters.flatMap { filter ->
            searchFields.single { it.key == filter.key }.toDataFilters(filter.value)
        }
    }

    private fun toPageableByPath(headers: List<SearchListColumn>, pageable: Pageable): Pageable {
        val sortOrders = pageable.sort.map { sort ->
            Sort.Order.by(headers.single { header -> header.key == sort.property }.path)
        }
        return PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by(sortOrders.toList()))
    }
}
