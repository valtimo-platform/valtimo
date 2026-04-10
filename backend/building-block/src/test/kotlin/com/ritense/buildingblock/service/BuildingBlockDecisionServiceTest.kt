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
import com.ritense.valtimo.operaton.domain.OperatonBytearray
import com.ritense.valtimo.service.OperatonByteArrayService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.DecisionDefinition
import org.operaton.bpm.engine.repository.DecisionDefinitionQuery
import org.operaton.bpm.engine.repository.ProcessDefinitionQuery

@ExtendWith(MockitoExtension::class)
class BuildingBlockDecisionServiceTest(
    @Mock private val repositoryService: RepositoryService,
    @Mock private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    @Mock private val operatonByteArrayService: OperatonByteArrayService,
) {

    private lateinit var service: BuildingBlockDecisionService

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("my-bb", "1.0.0")

    @BeforeEach
    fun setUp() {
        service = BuildingBlockDecisionService(repositoryService, buildingBlockDefinitionChecker, operatonByteArrayService)
    }

    @Test
    fun `should return decision definitions for building block`() {
        val decisionDefinition = mock<DecisionDefinition>()
        val query = mock<DecisionDefinitionQuery>()
        whenever(repositoryService.createDecisionDefinitionQuery()).thenReturn(query)
        whenever(query.versionTag("BB:my-bb:1.0.0")).thenReturn(query)
        whenever(query.list()).thenReturn(listOf(decisionDefinition))

        val result = service.getDecisionDefinitions(buildingBlockDefinitionId)

        assertThat(result).containsExactly(decisionDefinition)
    }

    @Test
    fun `should return empty list when no decision definitions found`() {
        val query = mock<DecisionDefinitionQuery>()
        whenever(repositoryService.createDecisionDefinitionQuery()).thenReturn(query)
        whenever(query.versionTag("BB:my-bb:1.0.0")).thenReturn(query)
        whenever(query.list()).thenReturn(emptyList())

        val result = service.getDecisionDefinitions(buildingBlockDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `should throw when deleting non-existent decision definition`() {
        val query = mock<DecisionDefinitionQuery>()
        whenever(repositoryService.createDecisionDefinitionQuery()).thenReturn(query)
        whenever(query.versionTag("BB:my-bb:1.0.0")).thenReturn(query)
        whenever(query.decisionDefinitionKey("missing-key")).thenReturn(query)
        whenever(query.singleResult()).thenReturn(null)

        val exception = assertThrows<IllegalArgumentException> {
            service.deleteDecisionDefinition(buildingBlockDefinitionId, "missing-key")
        }

        assertThat(exception.message).contains("missing-key")
        assertThat(exception.message).contains("not found")
    }

    @Test
    fun `should delete decision definition when it is the only resource in deployment`() {
        val decisionDefinition = mock<DecisionDefinition> {
            on { deploymentId } doReturn "dep-1"
        }
        val decisionQuery = mock<DecisionDefinitionQuery>()
        whenever(repositoryService.createDecisionDefinitionQuery()).thenReturn(decisionQuery)
        whenever(decisionQuery.versionTag("BB:my-bb:1.0.0")).thenReturn(decisionQuery)
        whenever(decisionQuery.decisionDefinitionKey("my-decision")).thenReturn(decisionQuery)
        whenever(decisionQuery.singleResult()).thenReturn(decisionDefinition)

        val deploymentDecisionQuery = mock<DecisionDefinitionQuery>()
        whenever(decisionQuery.deploymentId("dep-1")).thenReturn(deploymentDecisionQuery)
        whenever(deploymentDecisionQuery.list()).thenReturn(listOf(decisionDefinition))

        val processQuery = mock<ProcessDefinitionQuery>()
        whenever(repositoryService.createProcessDefinitionQuery()).thenReturn(processQuery)
        whenever(processQuery.deploymentId("dep-1")).thenReturn(processQuery)
        whenever(processQuery.list()).thenReturn(emptyList())

        service.deleteDecisionDefinition(buildingBlockDefinitionId, "my-decision")

        verify(repositoryService).deleteDeployment("dep-1")
    }

    @Test
    fun `should throw when deployment contains other resources besides the decision`() {
        val decisionDefinition = mock<DecisionDefinition> {
            on { deploymentId } doReturn "dep-1"
        }
        val otherDecision = mock<DecisionDefinition>()

        val decisionQuery = mock<DecisionDefinitionQuery>()
        whenever(repositoryService.createDecisionDefinitionQuery()).thenReturn(decisionQuery)
        whenever(decisionQuery.versionTag("BB:my-bb:1.0.0")).thenReturn(decisionQuery)
        whenever(decisionQuery.decisionDefinitionKey("my-decision")).thenReturn(decisionQuery)
        whenever(decisionQuery.singleResult()).thenReturn(decisionDefinition)

        val deploymentDecisionQuery = mock<DecisionDefinitionQuery>()
        whenever(decisionQuery.deploymentId("dep-1")).thenReturn(deploymentDecisionQuery)
        whenever(deploymentDecisionQuery.list()).thenReturn(listOf(decisionDefinition, otherDecision))

        val processQuery = mock<ProcessDefinitionQuery>()
        whenever(repositoryService.createProcessDefinitionQuery()).thenReturn(processQuery)
        whenever(processQuery.deploymentId("dep-1")).thenReturn(processQuery)
        whenever(processQuery.list()).thenReturn(emptyList())

        assertThrows<IllegalStateException> {
            service.deleteDecisionDefinition(buildingBlockDefinitionId, "my-decision")
        }
    }

    @Test
    fun `should return DMN model bytes`() {
        val expectedBytes = "<dmn-xml/>".toByteArray()
        val bytearray = mock<OperatonBytearray> {
            on { bytes } doReturn expectedBytes
        }
        val decisionDefinition = mock<DecisionDefinition> {
            on { resourceName } doReturn "my-decision.dmn"
            on { deploymentId } doReturn "dep-1"
        }
        whenever(operatonByteArrayService.getByNameAndDeploymentId("my-decision.dmn", "dep-1"))
            .thenReturn(bytearray)

        val result = service.getDmnModel(decisionDefinition)

        assertThat(result).isEqualTo(expectedBytes)
    }

    @Test
    fun `should throw when DMN model bytes are null`() {
        val bytearray = mock<OperatonBytearray> {
            on { bytes } doReturn null
        }
        val decisionDefinition = mock<DecisionDefinition> {
            on { resourceName } doReturn "my-decision.dmn"
            on { deploymentId } doReturn "dep-1"
        }
        whenever(operatonByteArrayService.getByNameAndDeploymentId("my-decision.dmn", "dep-1"))
            .thenReturn(bytearray)

        val exception = assertThrows<IllegalStateException> {
            service.getDmnModel(decisionDefinition)
        }

        assertThat(exception.message).contains("my-decision.dmn")
        assertThat(exception.message).contains("dep-1")
    }
}