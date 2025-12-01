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
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.iko.web.rest.request.IkoSearchActionCreateRequest
import com.ritense.iko.web.rest.request.IkoSearchActionUpdateRequest
import com.ritense.iko.web.rest.response.IkoSearchActionResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.iko.PropertyField
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
class IkoSearchActionManagementResource(
    private val service: IkoSearchActionService,
    private val ikoViewService: IkoViewService,
) {

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-property-fields/{type}/iko-search-action")
    fun getIkoRepositoryConfigPropertyFields(
        @PathVariable type: String,
    ): ResponseEntity<List<PropertyField>> {
        return ResponseEntity.ok(service.getIkoSearchActionPropertyFields(type))
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/iko-search-action")
    fun getIkoSearchActionsForManagement(
        @PathVariable ikoViewKey: String,
    ): ResponseEntity<List<IkoSearchActionResponse>> {
        val ikoSearchActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        return ResponseEntity.ok(ikoSearchActions.map { IkoSearchActionResponse.from(it) })
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/search-action/{key}")
    fun getIkoSearchAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSearchActionResponse> {
        val ikoSearchAction = service.getByKey(key, ikoViewKey)
        return ResponseEntity.ok(IkoSearchActionResponse.from(ikoSearchAction))
    }


    @RunWithoutAuthorization
    @PostMapping("/v1/iko-view/{ikoViewKey}/search-action/{key}")
    fun createIkoSearchAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSearchActionCreateRequest
    ): ResponseEntity<IkoSearchActionResponse> {
        val ikoView = ikoViewService.getByKey(ikoViewKey)
        val existingIkoSearchActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        val ikoSearchAction = service.create(
            ikoSearchAction = request.toEntity(key, ikoView, existingIkoSearchActions.maxOfOrNull { it.order + 1 } ?: 0)
        )
        return ResponseEntity.ok(IkoSearchActionResponse.from(ikoSearchAction))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/search-action/{key}")
    fun updateIkoSearchAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSearchActionUpdateRequest,
    ): ResponseEntity<IkoSearchActionResponse> {
        require(request.key == key)
        val existingIkoSearchAction = service.getByKey(ikoViewKey = ikoViewKey, key = key)
        val ikoSearchAction = service.update(
            ikoSearchAction = request.toEntity(
                existingIkoSearchAction.id.ikoView,
                existingIkoSearchAction.order,
            ),
        )
        return ResponseEntity.ok(IkoSearchActionResponse.from(ikoSearchAction))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/iko-search-action")
    fun updateIkoSearchActionsOrder(
        @PathVariable ikoViewKey: String,
        @RequestBody request: List<IkoSearchActionUpdateRequest>,
    ): ResponseEntity<List<IkoSearchActionResponse>> {
        val existingIkoSearchActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        require(request.map { it.key }.toSet() == existingIkoSearchActions.map { it.id.key }.toSet())
        val ikoSearchActions = request.mapIndexed { index, updatedIkoSearchAction ->
            val existingIkoSearchAction = existingIkoSearchActions.first { it.id.key == updatedIkoSearchAction.key }
            service.update(
                ikoSearchAction = existingIkoSearchAction.copy(order = index),
            )
        }
        return ResponseEntity.ok(ikoSearchActions.map { IkoSearchActionResponse.from(it) })
    }

    @RunWithoutAuthorization
    @DeleteMapping("/v1/iko-view/{ikoViewKey}/search-action/{key}")
    fun deleteIkoSearchAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSearchActionResponse> {
        service.delete(key, ikoViewKey)
        return ResponseEntity.noContent().build()
    }
}
