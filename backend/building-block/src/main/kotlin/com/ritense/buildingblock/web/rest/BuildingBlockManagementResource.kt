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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.semver4j.Semver
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockManagementResource(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) {
    @GetMapping
    fun getBuildingBlockDefinitions(): ResponseEntity<List<BuildingBlockDefinitionDto>> {
        val all = buildingBlockDefinitionRepository.findAll()

        val latestPerKey = all
            .groupBy { it.id.key }
            .values
            .mapNotNull { defsForKey ->
                defsForKey.maxWithOrNull { a, b ->
                    val va = Semver(a.id.versionTag.toString())
                    val vb = Semver(b.id.versionTag.toString())
                    va.compareTo(vb)
                }
            }

        val dtoList = latestPerKey.map {
            BuildingBlockDefinitionDto(
                key = it.id.key,
                versionTag = it.id.versionTag.toString(),
                title = it.title,
                description = it.description,
                createdBy = it.createdBy,
                createdDate = it.createdDate,
                basedOnVersionTag = it.basedOnVersionTag?.toString(),
                final = it.final
            )
        }

        return if (dtoList.isEmpty()) {
            ResponseEntity.notFound().build()
        } else {
            ResponseEntity.ok(dtoList)
        }
    }

    @PostMapping(consumes = [APPLICATION_JSON_UTF8_VALUE])
    fun createBuildingBlockDefinition(
        @RequestBody dto: CreateBuildingBlockDefinitionDto
    ): ResponseEntity<BuildingBlockDefinitionDto> {
        val entity = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(dto.key, dto.versionTag),
            title = dto.title,
            description = dto.description,
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )

        val saved = buildingBlockDefinitionRepository.save(entity)

        val savedDto = BuildingBlockDefinitionDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            title = saved.title,
            description = saved.description,
            createdBy = saved.createdBy,
            createdDate = saved.createdDate,
            basedOnVersionTag = saved.basedOnVersionTag?.toString(),
            final = saved.final
        )

        return ResponseEntity.ok(savedDto)
    }
}