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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.service.BuildingBlockDecisionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.web.rest.dto.DefinitionDeploymentResponseDto
import org.operaton.bpm.engine.impl.persistence.entity.DeploymentEntity
import org.operaton.bpm.engine.rest.dto.repository.DecisionDefinitionDto
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
import java.io.ByteArrayInputStream

@RestController
@SkipComponentScan
@RequestMapping("/api/management/v1/building-block", produces = [APPLICATION_JSON_UTF8_VALUE])
class BuildingBlockDecisionManagementResource(
    private val buildingBlockDecisionService: BuildingBlockDecisionService,
) {

    @EndpointDescription(
        en = "List building block decision definitions",
        nl = "Beslisdefinities van bouwblok ophalen",
    )
    @GetMapping(
        value = ["/{key}/version/{versionTag}/decision-definition"],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun listDecisionDefinitions(
        @PathVariable(name = "key") key: String,
        @PathVariable(name = "versionTag") versionTag: String,
    ): ResponseEntity<List<DecisionDefinitionDto>> {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)

        val decisionDefinitions = runWithoutAuthorization {
            buildingBlockDecisionService.getDecisionDefinitions(buildingBlockDefinitionId)
        }

        return ResponseEntity.ok(decisionDefinitions.map {
            DecisionDefinitionDto.fromDecisionDefinition(it)
        })
    }

    @EndpointDescription(
        en = "Deploy building block decision definition",
        nl = "Beslisdefinitie van bouwblok uitrollen",
    )
    @PostMapping(
        value = ["/{key}/version/{versionTag}/decision-definition"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun deployDecisionDefinition(
        @PathVariable(name = "key") key: String,
        @PathVariable(name = "versionTag") versionTag: String,
        @RequestPart(name = "file") dmn: MultipartFile
    ): ResponseEntity<Any> {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)
        val fileName = dmn.originalFilename
            ?: return ResponseEntity.badRequest().body("File name is required.")
        val normalizedFileName = fileName.substringAfterLast('/').substringAfterLast('\\')

        if (!normalizedFileName.endsWith(".dmn")) {
            return ResponseEntity.badRequest().body("Invalid file name. Must have '.dmn' suffix.")
        }

        return ResponseEntity.ok(
            DefinitionDeploymentResponseDto.of(
                runWithoutAuthorization {
                    buildingBlockDecisionService.deployDecisionDefinition(
                        buildingBlockDefinitionId,
                        normalizedFileName,
                        ByteArrayInputStream(dmn.bytes)
                    )
                } as DeploymentEntity
            )
        )
    }

    @EndpointDescription(
        en = "Delete building block decision definition",
        nl = "Beslisdefinitie van bouwblok verwijderen",
    )
    @DeleteMapping(
        value = ["/{key}/version/{versionTag}/decision-definition/{decisionDefinitionKey}"],
    )
    @Transactional
    fun deleteDecisionDefinition(
        @PathVariable(name = "key") key: String,
        @PathVariable(name = "versionTag") versionTag: String,
        @PathVariable(name = "decisionDefinitionKey") decisionDefinitionKey: String,
    ): ResponseEntity<Any> {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(key, versionTag)

        runWithoutAuthorization {
            buildingBlockDecisionService.deleteDecisionDefinition(
                buildingBlockDefinitionId,
                decisionDefinitionKey
            )
        }

        return ResponseEntity.noContent().build()
    }
}
