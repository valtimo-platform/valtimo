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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.event.DocumentPreDeleteEvent
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.time.LocalDateTime
import java.util.UUID

class BuildingBlockDocumentPreDeleteListenerTest {

    private lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository
    private lateinit var documentService: DocumentService
    private lateinit var runtimeService: RuntimeService
    private lateinit var listener: BuildingBlockDocumentPreDeleteListener

    private val caseDocumentId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        buildingBlockInstanceRepository = mock()
        documentService = mock()
        runtimeService = mock()
        listener = BuildingBlockDocumentPreDeleteListener(
            buildingBlockInstanceRepository,
            documentService,
            runtimeService
        )
    }

    @Test
    fun `should delete the root of a building block process instead of the subprocess itself`() {
        val nestedProcessInstanceId = "nested-process"
        val rootProcessInstanceId = "root-process"
        val instance = buildingBlockInstance(nestedProcessInstanceId)
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId))
            .doReturn(listOf(instance))
        val nested = processInstance(nestedProcessInstanceId, rootProcessInstanceId)
        mockQueries(caseRootProcessInstanceIds = emptyList(), buildingBlockProcessInstances = listOf(nested))

        listener.handleDocumentPreDeleteEvent(DocumentPreDeleteEvent(caseDocumentId))

        verify(runtimeService).deleteProcessInstance(rootProcessInstanceId, "Case deleted", true, true, true, false)
        verify(runtimeService, never()).deleteProcessInstance(
            eq(nestedProcessInstanceId), any(), any(), any(), any(), any()
        )
    }

    @Test
    fun `should delete a shared root process instance only once`() {
        val rootProcessInstanceId = "root-process"
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId))
            .doReturn(listOf(buildingBlockInstance("nested-one"), buildingBlockInstance("nested-two")))
        val nestedOne = processInstance("nested-one", rootProcessInstanceId)
        val nestedTwo = processInstance("nested-two", rootProcessInstanceId)
        mockQueries(
            caseRootProcessInstanceIds = listOf(rootProcessInstanceId),
            buildingBlockProcessInstances = listOf(nestedOne, nestedTwo)
        )

        listener.handleDocumentPreDeleteEvent(DocumentPreDeleteEvent(caseDocumentId))

        verify(runtimeService).deleteProcessInstance(rootProcessInstanceId, "Case deleted", true, true, true, false)
    }

    @Test
    fun `should not touch any process instance when the case has no building blocks`() {
        whenever(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).doReturn(emptyList())

        listener.handleDocumentPreDeleteEvent(DocumentPreDeleteEvent(caseDocumentId))

        verify(runtimeService, never()).createProcessInstanceQuery()
        verify(documentService, never()).deleteDocument(any())
    }

    private fun mockQueries(
        caseRootProcessInstanceIds: List<String>,
        buildingBlockProcessInstances: List<ProcessInstance>
    ) {
        // Every mock is built before any stubbing starts: creating a mock inside a whenever() chain leaves
        // Mockito with an unfinished stubbing.
        val caseProcessInstances = caseRootProcessInstanceIds.map { processInstance(it, it) }

        val caseQuery = mock<ProcessInstanceQuery>()
        whenever(caseQuery.processInstanceBusinessKey(caseDocumentId.toString())).doReturn(caseQuery)
        whenever(caseQuery.rootProcessInstances()).doReturn(caseQuery)
        whenever(caseQuery.list()).doReturn(caseProcessInstances)

        val buildingBlockQuery = mock<ProcessInstanceQuery>()
        whenever(buildingBlockQuery.processInstanceIds(any())).doReturn(buildingBlockQuery)
        whenever(buildingBlockQuery.list()).doReturn(buildingBlockProcessInstances)

        whenever(runtimeService.createProcessInstanceQuery()).doReturn(caseQuery, buildingBlockQuery)
    }

    private fun processInstance(processInstanceId: String, rootProcessInstanceId: String?): ProcessInstance =
        mock {
            on { this.processInstanceId } doReturn processInstanceId
            on { this.rootProcessInstanceId } doReturn rootProcessInstanceId
        }

    private fun buildingBlockInstance(processInstanceId: String) = BuildingBlockInstance(
        documentId = UUID.randomUUID(),
        caseDocumentId = caseDocumentId,
        processInstanceId = processInstanceId,
        definition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId.of("bezwaar", "1.0.0"),
            name = "Bezwaar",
            description = "description",
            createdBy = "tester",
            createdDate = LocalDateTime.now()
        )
    )
}
