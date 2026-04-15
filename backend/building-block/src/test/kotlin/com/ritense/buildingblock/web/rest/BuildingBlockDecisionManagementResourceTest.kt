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

package com.ritense.buildingblock.web.rest

import com.ritense.buildingblock.service.BuildingBlockDecisionService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.web.rest.dto.DefinitionDeploymentResponseDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import org.operaton.bpm.engine.impl.persistence.entity.DeploymentEntity
import org.operaton.bpm.engine.repository.DecisionDefinition
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile

@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BuildingBlockDecisionManagementResourceTest {

    @Mock
    private lateinit var operatonProcessService: OperatonProcessService

    @Mock
    private lateinit var buildingBlockDecisionService: BuildingBlockDecisionService

    private lateinit var resource: BuildingBlockDecisionManagementResource

    @BeforeEach
    fun setUp() {
        resource = BuildingBlockDecisionManagementResource(
            operatonProcessService,
            buildingBlockDecisionService,
        )
    }

    @Test
    fun `listDecisionDefinitions should return decision definitions for building block`() {
        val decisionDefinition = mock<DecisionDefinition> {
            on { id } doReturn "decision-1"
            on { key } doReturn "my-decision"
            on { name } doReturn "My Decision"
            on { version } doReturn 1
            on { category } doReturn null
            on { deploymentId } doReturn "dep-1"
            on { resourceName } doReturn "my-decision.dmn"
            on { tenantId } doReturn null
            on { decisionRequirementsDefinitionId } doReturn null
            on { decisionRequirementsDefinitionKey } doReturn null
            on { historyTimeToLive } doReturn 180
            on { versionTag } doReturn "BB:my-bb:1.0.0"
        }

        whenever(buildingBlockDecisionService.getDecisionDefinitions(any()))
            .thenReturn(listOf(decisionDefinition))

        val response = resource.listDecisionDefinitions("my-bb", "1.0.0")

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).hasSize(1)
        assertThat(response.body!![0].key).isEqualTo("my-decision")
    }

    @Test
    fun `listDecisionDefinitions should return empty list when no decisions found`() {
        whenever(buildingBlockDecisionService.getDecisionDefinitions(any()))
            .thenReturn(emptyList())

        val response = resource.listDecisionDefinitions("my-bb", "1.0.0")

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEmpty()
    }

    @Test
    fun `deployDecisionDefinition should reject files without dmn extension`() {
        val file = MockMultipartFile(
            "file",
            "my-decision.xml",
            "application/xml",
            "<definitions/>".toByteArray()
        )

        val response = resource.deployDecisionDefinition("my-bb", "1.0.0", file)

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `deployDecisionDefinition should reject files without filename`() {
        val file = MockMultipartFile(
            "file",
            null,
            "application/xml",
            "<definitions/>".toByteArray()
        )

        val response = resource.deployDecisionDefinition("my-bb", "1.0.0", file)

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `deployDecisionDefinition should deploy dmn file`() {
        val file = MockMultipartFile(
            "file",
            "my-decision.dmn",
            "application/xml",
            "<definitions/>".toByteArray()
        )

        val deploymentEntity = mock<DeploymentEntity> {
            on { id } doReturn "dep-1"
        }
        whenever(operatonProcessService.deploy(any<BuildingBlockDefinitionId>(), any<String>(), any(), any<Boolean>(), any<Boolean>()))
            .thenReturn(deploymentEntity)

        val response = resource.deployDecisionDefinition("my-bb", "1.0.0", file)

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        verify(operatonProcessService).deploy(any<BuildingBlockDefinitionId>(), eq("my-decision.dmn"), any(), eq(true), eq(false))
    }

    @Test
    fun `deleteDecisionDefinition should delete and return no content`() {
        val response = resource.deleteDecisionDefinition("my-bb", "1.0.0", "my-decision")

        assertThat(response.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(buildingBlockDecisionService).deleteDecisionDefinition(any(), eq("my-decision"))
    }
}
