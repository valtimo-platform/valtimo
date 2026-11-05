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

package com.ritense.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processlink.BaseIntegrationTest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@Transactional
internal class CopyProcessLinkOnProcessDeploymentListenerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processLinkService: ProcessLinkService

    @Autowired
    lateinit var repositoryService: OperatonRepositoryService

    @Autowired
    lateinit var operatonProcessService: OperatonProcessService

    private lateinit var processDefinition: OperatonProcessDefinition

    @BeforeEach
    fun beforeEach() {
        processDefinition = getLatestProcessDefinition()
    }

    @Test
    fun `should NOT copy process link on old process to a newly deployed process`() {
        // given
        val changedProcessBpmn = readFileAsString("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
            .replace("My service task", "My service task changed")
        runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId("autodeploy", "1.0.0"),
                "service-task-process.bpmn",
                changedProcessBpmn.byteInputStream()
            )
        }
        createProcessLink(processDefinition)
        val changedAgainProcessBpmn = readFileAsString("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
            .replace("My service task", "My service task changed again")

        // when
        runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId("autodeploy", "1.0.0"),
                "service-task-process.bpmn",
                changedAgainProcessBpmn.byteInputStream()
            )
        }

        // then
        val latestProcessDefinition = getLatestProcessDefinition()
        assertEquals(1, processDefinition.version)
        assertEquals(1, processLinkService.getProcessLinks(processDefinition.id, SERVICE_TASK_ID).count())
        assertEquals(3, latestProcessDefinition.version)
        assertEquals(0, processLinkService.getProcessLinks(latestProcessDefinition.id, SERVICE_TASK_ID).count())
    }

    @Test
    fun `should NOT copy process links to a building block that deploys the same process definition key`() {
        // given a case definition that owns a process with a process link
        createProcessLink(processDefinition)

        // when a building block deploys a process with the same process definition key
        val buildingBlockProcessBpmn =
            readFileAsString("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
        runWithoutAuthorization {
            operatonProcessService.deploy(
                BuildingBlockDefinitionId("service-task-block", "1.0.0"),
                "service-task-process.bpmn",
                buildingBlockProcessBpmn.byteInputStream()
            )
        }

        // then the case definition's process link did not leak into the building block's deployment
        val buildingBlockProcessDefinition = getLatestProcessDefinition()
        assertEquals("BB:service-task-block:1.0.0", buildingBlockProcessDefinition.versionTag)
        assertEquals(1, processLinkService.getProcessLinks(processDefinition.id, SERVICE_TASK_ID).count())
        assertEquals(0, processLinkService.getProcessLinks(buildingBlockProcessDefinition.id, SERVICE_TASK_ID).count())
    }

    @Test
    fun `should NOT copy process links to another case definition that deploys the same process definition key`() {
        // given a case definition that owns a process with a process link
        createProcessLink(processDefinition)

        // when another case definition deploys a process with the same process definition key
        val otherCaseProcessBpmn = readFileAsString("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
        runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId("test", "1.0.0"),
                "service-task-process.bpmn",
                otherCaseProcessBpmn.byteInputStream()
            )
        }

        // then the process link did not leak into the other case definition's deployment
        val otherCaseProcessDefinition = getLatestProcessDefinition()
        assertEquals("CD:test:1.0.0", otherCaseProcessDefinition.versionTag)
        assertEquals(1, processLinkService.getProcessLinks(processDefinition.id, SERVICE_TASK_ID).count())
        assertEquals(0, processLinkService.getProcessLinks(otherCaseProcessDefinition.id, SERVICE_TASK_ID).count())
    }

    @Test
    fun `should copy process links when the owning case definition deploys the process again`() {
        // given a case definition that owns a process with a process link
        createProcessLink(processDefinition)

        // when that same case definition version deploys a changed version of the process
        val changedProcessBpmn = readFileAsString("/config/case/autodeploy/1-0-0/bpmn/service-task-process.bpmn")
            .replace("My service task", "My service task changed")
        runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId("autodeploy", "1.0.0"),
                "service-task-process.bpmn",
                changedProcessBpmn.byteInputStream()
            )
        }

        // then the process link was carried forward
        val redeployedProcessDefinition = getLatestProcessDefinition()
        assertEquals("CD:autodeploy:1.0.0", redeployedProcessDefinition.versionTag)
        assertEquals(1, processLinkService.getProcessLinks(redeployedProcessDefinition.id, SERVICE_TASK_ID).count())
    }

    @Test
    fun `should copy process links from the same key in the original deployment of a multi-process file`() {
        val firstDeployment = deployTwoProcessFile("First", skipProcessLinksCopy = true)
        createProcessLink(firstDeployment.getValue(SECOND_PROCESS_KEY), SECOND_SERVICE_TASK_ID)
        deployTwoProcessFile("First, edited", skipProcessLinksCopy = true)

        val copy = deployTwoProcessFile(
            "First, copied",
            originalProcessDefinitionId = firstDeployment.getValue(FIRST_PROCESS_KEY)
        )

        assertEquals(
            1,
            processLinkService.getProcessLinks(copy.getValue(SECOND_PROCESS_KEY), SECOND_SERVICE_TASK_ID).count()
        )
    }

    private fun deployTwoProcessFile(
        firstProcessName: String,
        skipProcessLinksCopy: Boolean = false,
        originalProcessDefinitionId: String? = null
    ): Map<String, String> {
        val bpmn = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$FIRST_PROCESS_KEY" name="$firstProcessName" isExecutable="true">
                <bpmn:startEvent id="first-start" />
              </bpmn:process>
              <bpmn:process id="$SECOND_PROCESS_KEY" isExecutable="true">
                <bpmn:startEvent id="second-start" />
                <bpmn:serviceTask id="$SECOND_SERVICE_TASK_ID" camunda:delegateExpression="${'$'}{true}" />
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
        return runWithoutAuthorization {
            operatonProcessService.deploy(
                CaseDefinitionId("autodeploy", "1.0.0"),
                "two-process.bpmn",
                bpmn.byteInputStream(),
                skipProcessLinksCopy,
                false,
                null,
                originalProcessDefinitionId
            )
        }!!.deployedProcessDefinitions.associate { it.key to it.id }
    }

    private fun createProcessLink(processDefinition: OperatonProcessDefinition) =
        createProcessLink(processDefinition.id, SERVICE_TASK_ID)

    private fun createProcessLink(processDefinitionId: String, activityId: String) {
        processLinkService.createProcessLink(
            TestProcessLinkCreateRequestDto(
                processDefinitionId,
                activityId,
                ActivityTypeWithEventName.SERVICE_TASK_START,
            ),
            CaseDefinitionId.of("autodeploy", "1.0.0")
        )
    }

    private fun getLatestProcessDefinition(): OperatonProcessDefinition {
        return runWithoutAuthorization {
            repositoryService.findProcessDefinition(byKey(PROCESS_DEFINITION_KEY).and(byLatestVersion()))!!
        }
    }

    private fun readFileAsString(fileName: String) = this::class.java.getResource(fileName).readText(Charsets.UTF_8)

    companion object {
        private const val PROCESS_DEFINITION_KEY = "service-task-process"
        private const val SERVICE_TASK_ID = "my-service-task"
        private const val FIRST_PROCESS_KEY = "copy-link-first"
        private const val SECOND_PROCESS_KEY = "copy-link-second"
        private const val SECOND_SERVICE_TASK_ID = "copy-link-second-task"
    }
}
