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

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockInstanceDto
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockInstanceResource(
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
) {

    @GetMapping("/v1/case/{caseId}/building-blocks")
    fun getInstancesForCase(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID
    ): ResponseEntity<List<BuildingBlockInstanceDto>> {
        val instances = buildingBlockInstanceService.findAllByCaseDocumentId(caseId)
            .map(BuildingBlockInstanceDto::from)
        return ResponseEntity.ok(instances)
    }
}