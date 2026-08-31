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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.util.UUID

class BuildingBlockProcessVersionCheckerTest {

    private lateinit var instanceRepository: BuildingBlockInstanceRepository
    private lateinit var processDefinitionLinkRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var runtimeService: RuntimeService
    private lateinit var repositoryService: RepositoryService
    private lateinit var checker: BuildingBlockProcessVersionChecker

    private val bbKey = "verhuizing-inspectie"
    private val target = BuildingBlockDefinitionId.of(bbKey, "1.0.4")
    private val documentId = UUID.randomUUID()
    private val processInstanceId = "pi-1"
    private val processDefinitionKey = "verhuizing-inspectie-process"
    private val oldProcessDefinitionId = "$processDefinitionKey:3:old"
    private val newProcessDefinitionId = "$processDefinitionKey:4:new"

    private lateinit var instance: BuildingBlockInstance

    @BeforeEach
    fun setUp() {
        instanceRepository = mock()
        processDefinitionLinkRepository = mock()
        runtimeService = mock()
        repositoryService = mock()
        checker = BuildingBlockProcessVersionChecker(
            instanceRepository,
            processDefinitionLinkRepository,
            runtimeService,
            repositoryService,
        )

        instance = BuildingBlockInstance(
            documentId = documentId,
            caseDocumentId = UUID.randomUUID(),
            processInstanceId = processInstanceId,
            definition = BuildingBlockDefinition(id = target, name = bbKey),
        )
        whenever(instanceRepository.findByDocumentId(documentId)).thenReturn(instance)
        linksProcessDefinition(newProcessDefinitionId)
    }

    @Test
    fun `should pass when the plan migrated the process onto the version's own process definition`() {
        runningOn(newProcessDefinitionId)

        assertThatCode { checker.assertProcessOnVersion(documentId, target) }.doesNotThrowAnyException()
    }

    @Test
    fun `should fail when the plan left the process on the previous version's process definition`() {
        runningOn(oldProcessDefinitionId)

        assertThatThrownBy { checker.assertProcessOnVersion(documentId, target) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining(oldProcessDefinitionId)
            .hasMessageContaining(newProcessDefinitionId)
            .hasMessageContaining("processMigration")
    }

    @Test
    fun `should fail when the version has no process definition for the process the block is running`() {
        runningOn(oldProcessDefinitionId)
        whenever(processDefinitionLinkRepository.findAllByIdBuildingBlockDefinitionId(target))
            .thenReturn(emptyList())

        assertThatThrownBy { checker.assertProcessOnVersion(documentId, target) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining(processDefinitionKey)
            .hasMessageContaining("1.0.4")
    }

    @Test
    fun `should pass when the block never started a process`() {
        instance.processInstanceId = null

        assertThatCode { checker.assertProcessOnVersion(documentId, target) }.doesNotThrowAnyException()
    }

    @Test
    fun `should pass when the block's process has already ended`() {
        val query = mock<ProcessInstanceQuery>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(processInstanceId)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(null)

        assertThatCode { checker.assertProcessOnVersion(documentId, target) }.doesNotThrowAnyException()
    }

    @Test
    fun `should pass when the plan renamed the process and moved it onto the new key's definition`() {
        // The plan mapped the process onto a differently keyed one, so the running process carries the new key and the link must match.
        val renamedDefinitionId = "verhuizing-inspectie-process-v2:1:xyz"
        runningOn(renamedDefinitionId, processDefinitionKey = "verhuizing-inspectie-process-v2")
        linksProcessDefinition(renamedDefinitionId, processDefinitionKey = "verhuizing-inspectie-process-v2")

        assertThatCode { checker.assertProcessOnVersion(documentId, target) }.doesNotThrowAnyException()
    }

    private fun runningOn(processDefinitionId: String, processDefinitionKey: String = this.processDefinitionKey) {
        val query = mock<ProcessInstanceQuery>()
        val processInstance = mock<ProcessInstance>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(processInstanceId)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(processInstance)
        whenever(processInstance.processDefinitionId).thenReturn(processDefinitionId)

        val processDefinition = mock<ProcessDefinition>()
        whenever(processDefinition.key).thenReturn(processDefinitionKey)
        whenever(repositoryService.getProcessDefinition(processDefinitionId)).thenReturn(processDefinition)
    }

    private fun linksProcessDefinition(
        processDefinitionId: String,
        processDefinitionKey: String = this.processDefinitionKey,
    ) {
        val link = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId(processDefinitionId), target)
        )
        link.processDefinitionKey = processDefinitionKey
        whenever(processDefinitionLinkRepository.findAllByIdBuildingBlockDefinitionId(target))
            .thenReturn(listOf(link))
    }
}
