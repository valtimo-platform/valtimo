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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionService
import com.ritense.formflow.web.rest.result.FormFlowDefinitionDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockFormFlowManagementResource(
    private val buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService,
    private val buildingBlockFormFlowDefinitionImporter: BuildingBlockFormFlowDefinitionImporter,
) {

    @GetMapping("/{key}/version/{versionTag}/form-flow-definition")
    @Transactional
    fun getAllFormFlowDefinitions(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        pageable: Pageable
    ): ResponseEntity<Page<FormFlowDefinitionDto>> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val definitions = buildingBlockFormFlowDefinitionService.getFormFlowDefinitions(buildingBlockId, pageable)
            .map {
                FormFlowDefinitionDto.of(
                    it,
                    buildingBlockFormFlowDefinitionImporter.isAutoDeployed(buildingBlockId, it.id.key)
                )
            }
        return ResponseEntity.ok(definitions)
    }

    @GetMapping("/{key}/version/{versionTag}/form-flow-definition/{definitionKey}")
    @Transactional
    fun getFormFlowDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable definitionKey: String
    ): ResponseEntity<FormFlowDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val definition = buildingBlockFormFlowDefinitionService.getFormFlowDefinition(buildingBlockId, definitionKey)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(
            FormFlowDefinitionDto.of(
                definition,
                buildingBlockFormFlowDefinitionImporter.isAutoDeployed(buildingBlockId, definitionKey)
            )
        )
    }

    @PostMapping("/{key}/version/{versionTag}/form-flow-definition")
    @Transactional
    fun createFormFlowDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestBody definitionDto: FormFlowDefinitionDto
    ): ResponseEntity<FormFlowDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        if (buildingBlockFormFlowDefinitionService.getFormFlowDefinition(buildingBlockId, definitionDto.key) != null) {
            return ResponseEntity.badRequest().build()
        }
        val saved = buildingBlockFormFlowDefinitionService.save(buildingBlockId, definitionDto)
        return ResponseEntity.ok(FormFlowDefinitionDto.of(saved, false))
    }

    @PutMapping("/{key}/version/{versionTag}/form-flow-definition/{definitionKey}")
    @Transactional
    fun updateFormFlowDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable definitionKey: String,
        @RequestBody definitionDto: FormFlowDefinitionDto
    ): ResponseEntity<FormFlowDefinitionDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        if (definitionDto.key != definitionKey) {
            return ResponseEntity.badRequest().build()
        }
        if (buildingBlockFormFlowDefinitionImporter.isAutoDeployed(buildingBlockId, definitionKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        }
        val saved = buildingBlockFormFlowDefinitionService.save(buildingBlockId, definitionDto)
        return ResponseEntity.ok(FormFlowDefinitionDto.of(saved, false))
    }

    @DeleteMapping("/{key}/version/{versionTag}/form-flow-definition/{definitionKey}")
    @Transactional
    fun deleteFormFlowDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable definitionKey: String
    ): ResponseEntity<Unit> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        if (buildingBlockFormFlowDefinitionImporter.isAutoDeployed(buildingBlockId, definitionKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        }
        buildingBlockFormFlowDefinitionService.delete(buildingBlockId, definitionKey)
        return ResponseEntity.ok().build()
    }
}
