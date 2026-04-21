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

package com.ritense.buildingblock.service

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.service.OperatonByteArrayService
import com.ritense.valtimo.service.OperatonProcessService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DecisionDefinition
import org.operaton.bpm.engine.repository.DeploymentWithDefinitions
import java.io.ByteArrayInputStream

class BuildingBlockDecisionService(
    private val repositoryService: RepositoryService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val operatonByteArrayService: OperatonByteArrayService,
    private val operatonProcessService: OperatonProcessService,
) {

    fun deployDecisionDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        fileName: String,
        fileInput: ByteArrayInputStream
    ): DeploymentWithDefinitions {
        logger.info { "Deploying decision definition $fileName for building block $buildingBlockDefinitionId" }
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

        return operatonProcessService.deploy(
            buildingBlockDefinitionId,
            fileName,
            fileInput,
            true,
            false
        )
    }

    fun getDecisionDefinitions(buildingBlockDefinitionId: BuildingBlockDefinitionId): List<DecisionDefinition> {
        return repositoryService
            .createDecisionDefinitionQuery()
            .versionTag("${OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX}${buildingBlockDefinitionId}")
            .list()
    }

    fun deleteDecisionDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId, decisionDefinitionKey: String) {
        logger.info { "Deleting decision definition $decisionDefinitionKey for building block $buildingBlockDefinitionId" }
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

        val decisionDefinition = repositoryService
            .createDecisionDefinitionQuery()
            .versionTag("${OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX}${buildingBlockDefinitionId}")
            .decisionDefinitionKey(decisionDefinitionKey)
            .singleResult()

        if (decisionDefinition == null) {
            throw IllegalArgumentException(
                "Decision definition '$decisionDefinitionKey' not found for building block $buildingBlockDefinitionId."
            )
        }

        val allDecisions = repositoryService
            .createDecisionDefinitionQuery()
            .deploymentId(decisionDefinition.deploymentId)
            .list()

        val allProcesses = repositoryService
            .createProcessDefinitionQuery()
            .deploymentId(decisionDefinition.deploymentId)
            .list()

        if (allDecisions.size > 1 || allProcesses.isNotEmpty()) {
            throw IllegalStateException(
                "Failed to delete decision definition $decisionDefinitionKey for building block $buildingBlockDefinitionId. " +
                    "The deployment ${decisionDefinition.deploymentId} has more resources than only the single decision definition."
            )
        } else {
            repositoryService.deleteDeployment(decisionDefinition.deploymentId)
        }
    }

    fun getDmnModel(decisionDefinition: DecisionDefinition): ByteArray {
        return operatonByteArrayService.getByNameAndDeploymentId(
            decisionDefinition.resourceName,
            decisionDefinition.deploymentId
        ).bytes
            ?: error("DMN model bytes are null for resource '${decisionDefinition.resourceName}' in deployment '${decisionDefinition.deploymentId}'")
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
    }
}
