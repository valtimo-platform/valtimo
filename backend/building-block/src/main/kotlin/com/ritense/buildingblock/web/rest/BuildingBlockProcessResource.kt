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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.service.BuildingBlockDefinitionProcessDefinitionService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionWithLinksDto
import com.ritense.plugin.web.rest.result.PluginDefinitionsWithDependenciesDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockProcessResource(
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
    private val buildingBlockPluginDefinitionService: BuildingBlockPluginDefinitionService,
) {

    @GetMapping("/process-definition/{processDefinitionId}/is-building-block")
    fun isBuildingBlockProcess(
        @PathVariable processDefinitionId: String
    ): ResponseEntity<Boolean> {
        val result = runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.isBuildingBlockProcess(processDefinitionId)
        }
        return ResponseEntity.ok(result)
    }

    @GetMapping("/{key}/version/{versionTag}/process-definition")
    fun getProcessDefinitionsForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<List<BuildingBlockProcessDefinitionDto>> {
        val items = runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.getProcessDefinitionsForBuildingBlock(
                key,
                versionTag
            )
        }
        return ResponseEntity.ok(items)
    }

    @GetMapping("/{key}/version/{versionTag}/process-definition/{processDefinitionId}")
    fun getProcessDefinitionWithLinksForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable processDefinitionId: String,
    ): ResponseEntity<BuildingBlockProcessDefinitionWithLinksDto> {
        val dto = runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.getProcessDefinitionWithProcessLinks(
                key,
                versionTag,
                processDefinitionId
            )
        }
        return dto?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()
    }

    @PostMapping(
        value = ["/{key}/version/{versionTag}/process-definition/{processDefinitionId}"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun deployProcessDefinitionAndProcessLinksForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestPart(name = "file") bpmn: MultipartFile,
        @RequestPart(name = "processLinks") processLinks: List<ProcessLinkCreateRequestDto>,
        @RequestPart(name = "processDefinitionId") processDefinitionId: String?,
        @RequestPart(name = "main", required = false) main: Boolean? = false
    ): ResponseEntity<Any> {
        runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.deployProcessDefinitionAndProcessLinks(
                key,
                versionTag,
                bpmn,
                processLinks,
                processDefinitionId,
                main ?: false
            )
        }

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @GetMapping("/{key}/version/{versionTag}/plugin")
    fun getPluginDefinitionsForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<PluginDefinitionsWithDependenciesDto> {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val pluginKeysWithDependencies = runWithoutAuthorization {
            buildingBlockPluginDefinitionService.getPluginDefinitionsWithDependenciesForBuildingBlock(buildingBlockId)
        }

        return ResponseEntity.ok(pluginKeysWithDependencies)
    }

    @GetMapping("/{key}/version/{versionTag}/process-definition/{processDefinitionId}/plugin")
    fun getPluginDefinitionsForProcessDefinition(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable processDefinitionId: String
    ): ResponseEntity<List<String>> {
        val pluginKeys = runWithoutAuthorization {
            buildingBlockPluginDefinitionService.getPluginDefinitionKeysForProcessDefinition(processDefinitionId)
        }
        return ResponseEntity.ok(pluginKeys.toList().sorted())
    }

    @GetMapping("/{key}/version/{versionTag}/process-definition/main/key")
    fun getMainProcessDefinitionKeyForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String
    ): ResponseEntity<String> {
        val mainKey = runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.getMainProcessDefinitionKey(
                key,
                versionTag
            )
        }

        return mainKey?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()
    }

    @PostMapping("/{key}/version/{versionTag}/process-definition/{processDefinitionId}/main")
    fun setMainProcessDefinitionForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable processDefinitionId: String
    ): ResponseEntity<Void> {
        runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.setMainProcessDefinition(
                key,
                versionTag,
                processDefinitionId
            )
        }

        return ResponseEntity.noContent().build()
    }

    @DeleteMapping("/{key}/version/{versionTag}/process-definition/{processDefinitionId}")
    fun deleteProcessDefinitionForBuildingBlock(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable processDefinitionId: String
    ): ResponseEntity<Void> {
        return try {
            runWithoutAuthorization {
                buildingBlockDefinitionProcessDefinitionService.deleteProcessDefinitionForBuildingBlock(
                    key,
                    versionTag,
                    processDefinitionId
                )
            }
            ResponseEntity.noContent().build()
        } catch (ex: IllegalStateException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, ex.message, ex)
        }
    }
}
