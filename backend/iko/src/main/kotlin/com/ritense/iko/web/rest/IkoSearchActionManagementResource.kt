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
import com.ritense.iko.service.IkoSeachActionService
import com.ritense.iko.web.rest.request.IkoSeachActionCreateRequest
import com.ritense.iko.web.rest.request.IkoSeachActionUpdateRequest
import com.ritense.iko.web.rest.response.IkoSeachActionResponse
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
class IkoSeachActionManagementResource(
    private val service: IkoSeachActionService,
    private val ikoViewService: IkoViewService,
) {

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-property-fields/{type}/iko-search-action")
    fun getIkoRepositoryConfigPropertyFields(
        @PathVariable type: String,
    ): ResponseEntity<List<PropertyField>> {
        return ResponseEntity.ok(service.getIkoSeachActionPropertyFields(type))
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/iko-search-action")
    fun getIkoSeachActionsForManagement(
        @PathVariable ikoViewKey: String,
    ): ResponseEntity<List<IkoSeachActionResponse>> {
        val ikoSeachActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        return ResponseEntity.ok(ikoSeachActions.map { IkoSeachActionResponse.from(it) })
    }

    @RunWithoutAuthorization
    @GetMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{key}")
    fun getIkoSeachAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSeachActionResponse> {
        val ikoSeachAction = service.getByKey(key, ikoViewKey)
        return ResponseEntity.ok(IkoSeachActionResponse.from(ikoSeachAction))
    }


    @RunWithoutAuthorization
    @PostMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{key}")
    fun createIkoSeachAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSeachActionCreateRequest
    ): ResponseEntity<IkoSeachActionResponse> {
        val ikoView = ikoViewService.getByKey(ikoViewKey)
        val existingIkoSeachActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        val ikoSeachAction = service.create(
            ikoSeachAction = request.toEntity(key, ikoView, existingIkoSeachActions.maxOfOrNull { it.order + 1 } ?: 0)
        )
        return ResponseEntity.ok(IkoSeachActionResponse.from(ikoSeachAction))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{key}")
    fun updateIkoSeachAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @RequestBody request: IkoSeachActionUpdateRequest,
    ): ResponseEntity<IkoSeachActionResponse> {
        require(request.key == key)
        val existingIkoSeachAction = service.getByKey(ikoViewKey = ikoViewKey, key = key)
        val ikoSeachAction = service.update(
            ikoSeachAction = request.toEntity(
                existingIkoSeachAction.id.ikoView,
                existingIkoSeachAction.order,
            ),
        )
        return ResponseEntity.ok(IkoSeachActionResponse.from(ikoSeachAction))
    }

    @RunWithoutAuthorization
    @PutMapping("/v1/iko-view/{ikoViewKey}/iko-search-action")
    fun updateIkoSeachActionsOrder(
        @PathVariable ikoViewKey: String,
        @RequestBody request: List<IkoSeachActionUpdateRequest>,
    ): ResponseEntity<List<IkoSeachActionResponse>> {
        val existingIkoSeachActions = service.findAll(
            ikoViewKey = ikoViewKey,
        )
        require(request.map { it.key }.toSet() == existingIkoSeachActions.map { it.id.key }.toSet())
        val ikoSeachActions = request.mapIndexed { index, updatedIkoSeachAction ->
            val existingIkoSeachAction = existingIkoSeachActions.first { it.id.key == updatedIkoSeachAction.key }
            service.update(
                ikoSeachAction = existingIkoSeachAction.copy(order = index),
            )
        }
        return ResponseEntity.ok(ikoSeachActions.map { IkoSeachActionResponse.from(it) })
    }

    @RunWithoutAuthorization
    @DeleteMapping("/v1/iko-view/{ikoViewKey}/iko-search-action/{key}")
    fun deleteIkoSeachAction(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<IkoSeachActionResponse> {
        service.delete(key, ikoViewKey)
        return ResponseEntity.noContent().build()
    }
}
