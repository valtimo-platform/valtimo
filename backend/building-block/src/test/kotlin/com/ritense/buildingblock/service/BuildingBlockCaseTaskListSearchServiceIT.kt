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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.CaseTaskListSearchService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.tasksearch.SearchWithConfigRequest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class BuildingBlockCaseTaskListSearchServiceIT @Autowired constructor(
    private val caseTaskListSearchService: CaseTaskListSearchService,
    private val processDocumentService: ProcessDocumentService,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
) : BaseIntegrationTest() {

    @Test
    fun `should find building block user task in case task list`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList()
            )
        )

        val caseDocumentId = startCase()

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        assertThat(instances.first().caseDocumentId).isEqualTo(caseDocumentId)

        val searchResult = runWithoutAuthorization {
            caseTaskListSearchService.search(
                CASE_DEFINITION_NAME,
                SearchWithConfigRequest(),
                PageRequest.of(0, 50)
            )
        }

        assertThat(searchResult.totalElements).isEqualTo(1)
        val task = searchResult.content.first()
        assertThat(task.name).isEqualTo("BB User Task")
        assertThat(task.documentInstanceId).isEqualTo(caseDocumentId)
    }

    @Test
    fun `should not find building block user task for wrong case definition`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList()
            )
        )

        startCase()

        val searchResult = runWithoutAuthorization {
            caseTaskListSearchService.search(
                "nonexistent-case",
                SearchWithConfigRequest(),
                PageRequest.of(0, 50)
            )
        }

        assertThat(searchResult.totalElements).isEqualTo(0)
    }

    private fun startCase(): UUID {
        val caseContent = objectMapper.createObjectNode()
        val request = NewDocumentAndStartProcessRequest(
            MAIN_PROCESS_KEY,
            NewDocumentRequest(
                CASE_DEFINITION_NAME,
                CASE_DEFINITION_KEY,
                CASE_DEFINITION_VERSION,
                caseContent
            )
        )
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(request)
        }
        return result.resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created") }
            .id()
            .getId()
    }

    private fun processDefinitionId(): String {
        val definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$MAIN_PROCESS_KEY' not deployed")
        return definition.id
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "bb-call-activity-main-with-user-task"
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
