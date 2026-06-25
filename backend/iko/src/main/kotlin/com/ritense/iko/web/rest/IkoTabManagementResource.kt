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
import com.ritense.iko.service.IkoTabService
import com.ritense.iko.web.rest.request.IkoTabCreateRequest
import com.ritense.iko.web.rest.request.IkoTabUpdateRequest
import com.ritense.tab.web.rest.dto.TabDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.contract.iko.PropertyField
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
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class IkoTabManagementResource(
    private val service: IkoTabService,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get IKO tab property fields by type",
        nl = "Eigenschapsvelden van IKO-tabblad ophalen per type",
    )
    @GetMapping("/v1/iko-property-fields/{type}/tab")
    fun getIkoTabPropertyFields(
        @PathVariable type: String,
    ): ResponseEntity<List<PropertyField>> {
        return ResponseEntity.ok(service.getIkoTabPropertyFields(type))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List IKO tabs for management",
        nl = "IKO-tabbladen ophalen voor beheer",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab")
    fun getIkoTabsForManagement(
        @PathVariable ikoViewKey: String,
    ): ResponseEntity<List<TabDto>> {
        val ikoTabs = service.findAllTabsByIkoViewKey(
            ikoViewKey = ikoViewKey,
        )
        return ResponseEntity.ok(ikoTabs.map { TabDto.from(it) })
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get IKO tab by key",
        nl = "IKO-tabblad ophalen op sleutel",
    )
    @GetMapping("/v1/iko-view/{ikoViewKey}/tab/{key}")
    fun getIkoTab(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<TabDto> {
        val ikoTab = service.getByKey(ikoViewKey, key)
        return ResponseEntity.ok(TabDto.from(ikoTab))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Create IKO tab",
        nl = "IKO-tabblad aanmaken",
    )
    @PostMapping("/v1/iko-view/{ikoViewKey}/tab/{key}")
    fun createIkoTab(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @Valid @RequestBody request: IkoTabCreateRequest
    ): ResponseEntity<TabDto> {
        val ikoTab = service.create(
            ikoViewKey = ikoViewKey,
            tab = request.toEntity(key),
        )
        return ResponseEntity.ok(TabDto.from(ikoTab))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update IKO tab",
        nl = "IKO-tabblad bijwerken",
    )
    @PutMapping("/v1/iko-view/{ikoViewKey}/tab/{key}")
    fun updateIkoTab(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
        @Valid @RequestBody request: IkoTabUpdateRequest,
    ): ResponseEntity<TabDto> {
        require(request.key == key)
        val existingIkoTab = service.findByKey(
            ikoViewKey = ikoViewKey,
            tabKey = key
        )
        requireNotNull(existingIkoTab)
        val updatedIkoTab = request.toEntity(id = existingIkoTab.id, order = existingIkoTab.order)
        val ikoTab = service.update(ikoViewKey, updatedIkoTab)
        return ResponseEntity.ok(TabDto.from(ikoTab))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update IKO tabs order",
        nl = "Volgorde van IKO-tabbladen bijwerken",
    )
    @PutMapping("/v1/iko-view/{ikoViewKey}/tab")
    fun updateIkoTabOrder(
        @PathVariable ikoViewKey: String,
        @Valid @RequestBody request: List<IkoTabUpdateRequest>,
    ): ResponseEntity<List<TabDto>> {
        val existingIkoTabs = service.findAllTabsByIkoViewKey(
            ikoViewKey = ikoViewKey,
        )
        require(request.map { it.key }.toSet() == existingIkoTabs.map { it.key }.toSet())
        val ikoTabs = request.mapIndexed { index, updatedTab ->
            val existingTab = existingIkoTabs.first { it.key == updatedTab.key }
            service.update(ikoViewKey, existingTab.copy(order = index))
        }
        return ResponseEntity.ok(ikoTabs.map { TabDto.from(it) })
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete IKO tab",
        nl = "IKO-tabblad verwijderen",
    )
    @DeleteMapping("/v1/iko-view/{ikoViewKey}/tab/{key}")
    fun deleteIkoTab(
        @PathVariable ikoViewKey: String,
        @PathVariable key: String,
    ): ResponseEntity<TabDto> {
        service.deleteByKey(ikoViewKey, key)
        return ResponseEntity.noContent().build()
    }
}
