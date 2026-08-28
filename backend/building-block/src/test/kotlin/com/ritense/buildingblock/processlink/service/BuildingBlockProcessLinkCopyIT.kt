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

package com.ritense.buildingblock.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Guards the deployment-time half of the copy: only a real deployment catches a validator reading the BPMN
 * back from the repository service, whose resources are unflushed while the command context is open.
 */
@Transactional
class BuildingBlockProcessLinkCopyIT @Autowired constructor(
    private val processLinkRepository: ProcessLinkRepository,
    private val repositoryService: RepositoryService,
    private val operatonProcessService: OperatonProcessService,
) : BaseIntegrationTest() {

    @Test
    fun `should copy a building block process link to a redeployed process definition`() {
        val originalProcessDefinitionId = latestProcessDefinitionId()
        processLinkRepository.save(buildingBlockProcessLink(originalProcessDefinitionId))

        assertThatCode { redeployMainProcess("Call Building Block - changed") }
            .doesNotThrowAnyException()

        val redeployedProcessDefinitionId = latestProcessDefinitionId()
        assertThat(redeployedProcessDefinitionId).isNotEqualTo(originalProcessDefinitionId)

        val copiedLinks = processLinkRepository
            .findByProcessDefinitionIdAndActivityId(redeployedProcessDefinitionId, CALL_ACTIVITY_ID)
        assertThat(copiedLinks).singleElement()
            .isInstanceOfSatisfying(BuildingBlockProcessLink::class.java) { link ->
                assertThat(link.buildingBlockDefinitionId)
                    .isEqualTo(BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION))
                assertThat(link.activityType).isEqualTo(ActivityTypeWithEventName.CALL_ACTIVITY_START)
            }
    }

    private fun redeployMainProcess(callActivityName: String) {
        val bpmn = readFileAsString(MAIN_PROCESS_RESOURCE)
            .replace("Call Building Block", callActivityName)
        runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                "$MAIN_PROCESS_KEY.bpmn",
                bpmn.byteInputStream()
            )
        }
    }

    private fun buildingBlockProcessLink(processDefinitionId: String) = BuildingBlockProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = CALL_ACTIVITY_ID,
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION),
        pluginConfigurationMappings = emptyMap()
    )

    private fun latestProcessDefinitionId(): String = repositoryService.createProcessDefinitionQuery()
        .processDefinitionKey(MAIN_PROCESS_KEY)
        .latestVersion()
        .singleResult()
        ?.id
        ?: throw IllegalStateException("Process definition '$MAIN_PROCESS_KEY' not deployed")

    private fun readFileAsString(fileName: String) = this::class.java.getResource(fileName)!!.readText(Charsets.UTF_8)

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val MAIN_PROCESS_KEY = "building-block-call-activity-main"
        private const val CALL_ACTIVITY_ID = "callActivity"
        private const val MAIN_PROCESS_RESOURCE =
            "/config/case/bb-case/1-0-0/bpmn/building-block-call-activity-main.bpmn"
    }
}
