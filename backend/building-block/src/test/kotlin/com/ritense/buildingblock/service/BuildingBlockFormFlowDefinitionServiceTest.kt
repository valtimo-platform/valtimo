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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.service.FormFlowService
import com.ritense.formflow.web.rest.result.FormFlowDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest

@ExtendWith(MockitoExtension::class)
class BuildingBlockFormFlowDefinitionServiceTest(
    @Mock private val formFlowService: FormFlowService,
    @Mock private val definitionChecker: BuildingBlockDefinitionChecker,
) {
    private lateinit var service: BuildingBlockFormFlowDefinitionService

    private val bbId = BuildingBlockDefinitionId("my-bb", "1.0.0")

    @BeforeEach
    fun setUp() {
        service = BuildingBlockFormFlowDefinitionService(formFlowService, definitionChecker)
    }

    @Test
    fun `getFormFlowDefinitions asserts bb exists and delegates to formFlowService`() {
        val pageable = PageRequest.of(0, 10)
        val mockDefinition = mock<FormFlowDefinition>()
        whenever(formFlowService.getFormFlowDefinitions(eq(bbId), eq(pageable))).thenReturn(PageImpl(listOf(mockDefinition)))

        val result = service.getFormFlowDefinitions(bbId, pageable)

        verify(definitionChecker).assertBuildingBlockDefinitionExists(bbId)
        assertThat(result.content).containsExactly(mockDefinition)
    }

    @Test
    fun `getFormFlowDefinition asserts bb exists and delegates to formFlowService`() {
        val mockDefinition = mock<FormFlowDefinition>()
        whenever(formFlowService.findDefinitionOrNull(eq("my-flow"), eq(bbId))).thenReturn(mockDefinition)

        val result = service.getFormFlowDefinition(bbId, "my-flow")

        verify(definitionChecker).assertBuildingBlockDefinitionExists(bbId)
        assertThat(result).isEqualTo(mockDefinition)
    }

    @Test
    fun `getFormFlowDefinition returns null when definition not found`() {
        whenever(formFlowService.findDefinitionOrNull(eq("missing-flow"), eq(bbId))).thenReturn(null)

        val result = service.getFormFlowDefinition(bbId, "missing-flow")

        assertThat(result).isNull()
    }

    @Test
    fun `save asserts update permission and delegates to formFlowService`() {
        val dto = FormFlowDefinitionDto(key = "my-flow", startStep = "first", steps = emptyList())
        val mockDefinition = mock<FormFlowDefinition>()
        whenever(formFlowService.save(any<FormFlowDefinition>())).thenReturn(mockDefinition)

        val result = service.save(bbId, dto)

        verify(definitionChecker).assertCanUpdateBuildingBlockDefinition(bbId)
        assertThat(result).isEqualTo(mockDefinition)
    }

    @Test
    fun `delete asserts update permission and delegates to formFlowService`() {
        service.delete(bbId, "my-flow")

        verify(definitionChecker).assertCanUpdateBuildingBlockDefinition(bbId)
        verify(formFlowService).deleteByKeyAndBuildingBlockDefinition(eq("my-flow"), eq(bbId))
    }
}
