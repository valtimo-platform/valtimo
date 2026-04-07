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

package com.ritense.buildingblock.service

import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.service.FormFlowService
import com.ritense.formflow.web.rest.result.FormFlowDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Transactional

@Transactional
class BuildingBlockFormFlowDefinitionService(
    private val formFlowService: FormFlowService,
    private val definitionChecker: BuildingBlockDefinitionChecker,
) {
    @Transactional(readOnly = true)
    fun getFormFlowDefinitions(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        pageable: Pageable
    ): Page<FormFlowDefinition> {
        definitionChecker.assertBuildingBlockDefinitionExists(buildingBlockDefinitionId)
        return formFlowService.getFormFlowDefinitions(buildingBlockDefinitionId, pageable)
    }

    @Transactional(readOnly = true)
    fun getFormFlowDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        definitionKey: String
    ): FormFlowDefinition? {
        definitionChecker.assertBuildingBlockDefinitionExists(buildingBlockDefinitionId)
        return formFlowService.findDefinitionOrNull(definitionKey, buildingBlockDefinitionId)
    }

    fun save(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        dto: FormFlowDefinitionDto
    ): FormFlowDefinition {
        definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        return formFlowService.save(dto.toEntity(buildingBlockDefinitionId))
    }

    fun delete(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        definitionKey: String
    ) {
        definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        formFlowService.deleteByKeyAndBuildingBlockDefinition(definitionKey, buildingBlockDefinitionId)
    }

    fun isAutoDeployed(definitionKey: String): Boolean {
        // Building block form flows deployed via classpath are considered read-only
        return false
    }
}
