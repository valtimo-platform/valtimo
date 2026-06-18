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

package com.ritense.objectmanagement.web.rest

import com.ritense.objectmanagement.domain.ObjectManagement
import com.ritense.objectmanagement.domain.ObjectsListRowDto
import com.ritense.objectmanagement.domain.search.SearchWithConfigRequest
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api/v1/object/management/configuration", produces = [APPLICATION_JSON_UTF8_VALUE])
class ObjectManagementResource(
    private val objectManagementService: ObjectManagementService
) {

    @EndpointDescription(
        en = "Create object management configuration",
        nl = "Objectbeheerconfiguratie aanmaken",
    )
    @PostMapping
    fun create(@Valid @RequestBody objectManagement: ObjectManagement): ResponseEntity<ObjectManagement> =
        ResponseEntity.ok(objectManagementService.create(objectManagement))

    @EndpointDescription(
        en = "Update object management configuration",
        nl = "Objectbeheerconfiguratie bijwerken",
    )
    @PutMapping
    fun update(@Valid @RequestBody objectManagement: ObjectManagement): ResponseEntity<ObjectManagement> =
        ResponseEntity.ok(objectManagementService.update(objectManagement))

    @EndpointDescription(
        en = "Get object management configuration by id",
        nl = "Objectbeheerconfiguratie op id ophalen",
    )
    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): ResponseEntity<ObjectManagement?> =
        ResponseEntity.ok(objectManagementService.getById(id))

    @EndpointDescription(
        en = "List object management configurations",
        nl = "Objectbeheerconfiguraties ophalen",
    )
    @GetMapping
    fun getAll() = ResponseEntity.ok(objectManagementService.getAll())

    @EndpointDescription(
        en = "Delete object management configuration",
        nl = "Objectbeheerconfiguratie verwijderen",
    )
    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: UUID): ResponseEntity<Any> {
        objectManagementService.deleteById(id)
        return ResponseEntity.noContent().build()
    }

    @EndpointDescription(
        en = "List objects for configuration",
        nl = "Objecten voor configuratie ophalen",
    )
    @GetMapping("/{id}/object")
    fun getObjects(
        @PathVariable id: UUID,
        @PageableDefault pageable: Pageable
    ): ResponseEntity<PageImpl<ObjectsListRowDto>> =
        ResponseEntity.ok(objectManagementService.getObjects(id, pageable))

    @EndpointDescription(
        en = "Search objects with search fields",
        nl = "Objecten met zoekvelden ophalen",
    )
    @PostMapping("/{id}/object")
    fun getObjectsWithSearchFields(
        @PathVariable id: UUID,
        @PageableDefault pageable: Pageable,
        @Valid @RequestBody searchRequest: SearchWithConfigRequest
    ): ResponseEntity<PageImpl<ObjectsListRowDto>> =
        ResponseEntity.ok(objectManagementService.getObjectsWithSearchParams(searchRequest, id, pageable))
}
