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

package com.ritense.valtimo.decision

import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.operaton.domain.OperatonDecisionDefinition
import com.ritense.valtimo.operaton.repository.OperatonDecisionDefinitionSpecificationHelper.Companion.byNotLinkedToBuildingBlock
import com.ritense.valtimo.operaton.repository.OperatonDecisionDefinitionSpecificationHelper.Companion.byNotLinkedToCaseDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonByteArrayService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DecisionDefinition

class OperatonDecisionService(
    private val repositoryService: RepositoryService,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val operatonByteArrayService: OperatonByteArrayService,
    private val operatonRepositoryService: OperatonRepositoryService,
) {

    fun getDecisionDefinitions(caseDefinitionId: CaseDefinitionId): List<DecisionDefinition> {
        // It is not possible to look for a decision definition by version tag so we get them all and filter based on the version tag
        val decisionDefinitions = repositoryService
            .createDecisionDefinitionQuery()
            .versionTag("${OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX}${caseDefinitionId}")
            .list()

        return decisionDefinitions
    }

    /**
     * Returns the "global" decision definitions: those that are not linked to a case definition
     * (version tag prefix "CD:") nor to a building block definition (version tag prefix "BB:").
     * All versions are returned so callers can build a version overview.
     */
    fun getUnlinkedDecisionDefinitions(): List<OperatonDecisionDefinition> {
        return operatonRepositoryService.findDecisionDefinitions(
            byNotLinkedToCaseDefinition().and(byNotLinkedToBuildingBlock())
        )
    }

    fun deleteDecisionDefinition(caseDefinitionId: CaseDefinitionId, decisionDefinitionKey: String) {

        logger.error { "Deleting decision definition $decisionDefinitionKey for case definition $caseDefinitionId" }
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)

        val decisionDefinition = repositoryService
            .createDecisionDefinitionQuery()
            .versionTag("${OPERATON_CASE_DEFINITION_VERSION_TAG_PREFIX}${caseDefinitionId}")
            .decisionDefinitionKey(decisionDefinitionKey)
            .singleResult()

        if (decisionDefinition == null) {
            logger.error { "Failed to delete decision definition $decisionDefinitionKey for case definition $caseDefinitionId." }
            return
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
                "Failed to delete decision definition $decisionDefinitionKey for case definition $caseDefinitionId. " +
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
        ).bytes!!
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}