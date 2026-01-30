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

package com.ritense.buildingblock.service

import com.ritense.authorization.AuthorizationService
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.exception.BuildingBlockProcessDefinitionKeyAlreadyExistsException
import com.ritense.buildingblock.exception.DuplicateProcessDefinitionDescriptor
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doNothing
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.mock.web.MockMultipartFile

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionProcessDefinitionServiceTest {

    @Mock
    private lateinit var repositoryService: RepositoryService

    @Mock
    private lateinit var processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository

    @Mock
    private lateinit var operatonProcessService: OperatonProcessService

    @Mock
    private lateinit var processLinkService: ProcessLinkService

    @Mock
    private lateinit var processDeploymentService: ProcessDeploymentService

    @Mock
    private lateinit var authorizationService: AuthorizationService

    @Mock
    private lateinit var buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker

    private lateinit var service: BuildingBlockDefinitionProcessDefinitionService

    @BeforeEach
    fun setUp() {
        service = BuildingBlockDefinitionProcessDefinitionService(
            repositoryService,
            processDefinitionBuildingBlockDefinitionRepository,
            operatonProcessService,
            processLinkService,
            emptyList(),
            processDeploymentService,
            authorizationService,
            buildingBlockDefinitionChecker
        )
    }

    @Test
    fun `deploy rejects duplicate process definition key within building block`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId("bezwaar", "1.0.0")
        val linkId = ProcessDefinitionBuildingBlockDefinitionId(
            ProcessDefinitionId.of("existing-id"),
            buildingBlockDefinitionId
        )
        val existingLink = ProcessDefinitionBuildingBlockDefinition(linkId, false)
        existingLink.processDefinitionKey = "building-block-process"
        existingLink.processDefinitionName = "Building block process"

        whenever(
            processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(
                buildingBlockDefinitionId
            )
        ).thenReturn(listOf(existingLink))

        doNothing().whenever(authorizationService).requirePermission(any())
        doNothing().whenever(buildingBlockDefinitionChecker).assertCanUpdateBuildingBlockDefinition(
            buildingBlockDefinitionId
        )

        val bytes = javaClass.getResourceAsStream(
            "/config/building-block/bezwaar/1-0-0/bpmn/building-block-process.bpmn"
        )!!.readBytes()
        val file = MockMultipartFile(
            "file",
            "building-block-process.bpmn",
            "application/xml",
            bytes
        )

        val exception = assertThrows(BuildingBlockProcessDefinitionKeyAlreadyExistsException::class.java) {
            service.deployProcessDefinitionAndProcessLinks(
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag.toString(),
                file,
                emptyList(),
                null,
                false,
                false
            )
        }

        @Suppress("UNCHECKED_CAST")
        val duplicates = exception.parameters["duplicateProcessDefinitions"] as List<DuplicateProcessDefinitionDescriptor>
        assertTrue(duplicates.any { it.key == "building-block-process" && it.name == "Building block process" })
        verify(processDefinitionBuildingBlockDefinitionRepository).findAllByIdBuildingBlockDefinitionId(
            buildingBlockDefinitionId
        )
        verifyNoInteractions(processDeploymentService)
    }

    @Test
    fun `deploy replaces existing process definition when replace is true`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId("bezwaar", "1.0.0")
        val linkId = ProcessDefinitionBuildingBlockDefinitionId(
            ProcessDefinitionId.of("existing-id"),
            buildingBlockDefinitionId
        )
        val existingLink = ProcessDefinitionBuildingBlockDefinition(linkId, true)
        existingLink.processDefinitionKey = "building-block-process"

        whenever(
            processDefinitionBuildingBlockDefinitionRepository.findAllByIdBuildingBlockDefinitionId(
                buildingBlockDefinitionId
            )
        ).thenReturn(listOf(existingLink))

        doNothing().whenever(authorizationService).requirePermission(any())
        doNothing().whenever(buildingBlockDefinitionChecker).assertCanUpdateBuildingBlockDefinition(
            buildingBlockDefinitionId
        )

        val bytes = javaClass.getResourceAsStream(
            "/config/building-block/bezwaar/1-0-0/bpmn/building-block-process.bpmn"
        )!!.readBytes()
        val file = MockMultipartFile(
            "file",
            "building-block-process.bpmn",
            "application/xml",
            bytes
        )

        whenever(
            processDeploymentService.deployProcessDefinitionAndProcessLinks(
                buildingBlockDefinitionId,
                file,
                emptyList(),
                null
            )
        ).thenReturn(ProcessDefinitionId.of("new-id"))

        val bpmnModel = Bpmn.readModelFromStream(bytes.inputStream())
        whenever(operatonProcessService.getBpmnModelInstanceByProcessDefinitionId("new-id"))
            .thenReturn(bpmnModel)
        doNothing().whenever(operatonProcessService).setBuildingBlockDefinitionProcessesVersionTags(
            bpmnModel,
            buildingBlockDefinitionId
        )

        service.deployProcessDefinitionAndProcessLinks(
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag.toString(),
            file,
            emptyList(),
            null,
            false,
            true
        )

        verify(processDefinitionBuildingBlockDefinitionRepository).delete(existingLink)
        verify(operatonProcessService).deleteProcessDefinition("existing-id")
        verify(processLinkService).deleteProcessLinksForProcessDefinition("existing-id")
    }
}
