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

package com.ritense.objectmanagement.web.rest

import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/object-management", produces = [APPLICATION_JSON_UTF8_VALUE])
class ObjectManagementObjectResource(
    private val objectManagementService: ObjectManagementService
) {

    @GetMapping("/objects")
    fun getObjects(
        @RequestParam(required = false) id: UUID?,
        @RequestParam(required = false) title: String?,
        @RequestParam(required = false) dataAttrs: String?,
        @PageableDefault(size = 20) pageable: Pageable
    ): ResponseEntity<Page<ObjectWrapper>> {
        if ((id == null) == (title == null)) {
            return ResponseEntity.badRequest().build()
        }

        return ResponseEntity.ok(
            objectManagementService.getObjectsByConfig(id, title, dataAttrs, pageable)
        )
    }

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleIllegalArgument(e: IllegalArgumentException): ResponseEntity<Void> =
        ResponseEntity.badRequest().build()
}
