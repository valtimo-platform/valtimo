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

package com.ritense.buildingblock.web.rest

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockValueResolverResource(
    private val valueResolverService: ValueResolverService
) {

    @PostMapping("/management/v1/value-resolver/building-block/{buildingBlockDefinitionKey}/version/{buildingBlockDefinitionVersionTag}/keys")
    fun getResolvableKeys(
        @PathVariable buildingBlockDefinitionKey: String,
        @PathVariable buildingBlockDefinitionVersionTag: String,
        @RequestBody request: ValueResolverOptionRequest
    ): ResponseEntity<List<ValueResolverOption>> {
        return ResponseEntity.ok(
            valueResolverService.getResolvableKeys(
                request,
                BuildingBlockDefinitionId.of(buildingBlockDefinitionKey, buildingBlockDefinitionVersionTag)
            )
        )
    }
}
