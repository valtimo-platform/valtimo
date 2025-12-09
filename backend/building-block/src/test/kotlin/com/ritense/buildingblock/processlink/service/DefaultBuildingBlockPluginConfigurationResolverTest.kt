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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.time.LocalDateTime
import java.util.UUID

class DefaultBuildingBlockPluginConfigurationResolverTest {

    private val buildingBlockInstanceService = mock<BuildingBlockInstanceService>()
    private val processLinkService = mock<ProcessLinkService>()

    private val resolver = DefaultBuildingBlockPluginConfigurationResolver(
        buildingBlockInstanceService,
        processLinkService
    )

    @Test
    fun `should resolve plugin configuration mapping for building block instance`() {
        val documentId = UUID.randomUUID()
        val testProcessDefinitionId = "case-process"
        val activityId = "callActivity"
        val pluginConfigurationId = UUID.randomUUID()
        val execution = mock<DelegateExecution> {
            on { businessKey } doReturn documentId.toString()
            on { processDefinitionId } doReturn testProcessDefinitionId
        }
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId,
            "Test block",
            "desc",
            "tester",
            LocalDateTime.now(),
            null,
            false
        )
        whenever(buildingBlockInstanceService.getByDocumentId(documentId)).thenReturn(
            BuildingBlockInstance(
                documentId = documentId,
                caseDocumentId = UUID.randomUUID(),
                activityId = activityId,
                definition = definition
            )
        )

        whenever(processLinkService.getProcessLinks(testProcessDefinitionId, activityId)).thenReturn(
            listOf(
                BuildingBlockProcessLink(
                    id = UUID.randomUUID(),
                    processDefinitionId = testProcessDefinitionId,
                    activityId = activityId,
                    activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                    buildingBlockDefinitionId = buildingBlockDefinitionId,
                    pluginConfigurationMappings = mapOf("plugin-definition" to pluginConfigurationId),
                    inputMappings = emptyList()
                )
            )
        )

        val resolved = resolver.resolve(execution, "plugin-definition")

        assertThat(resolved).isEqualTo(pluginConfigurationId)
        verify(processLinkService).getProcessLinks(testProcessDefinitionId, activityId)
    }

    @Test
    fun `should throw when business key is not a uuid`() {
        val execution = mock<DelegateExecution> {
            on { businessKey } doReturn "not-a-uuid"
        }

        assertThatThrownBy { resolver.resolve(execution, "any") }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("businessKey must be a UUID")

        verify(buildingBlockInstanceService, never()).getByDocumentId(any())
    }

    @Test
    fun `should throw when no matching building block instance is found`() {
        val documentId = UUID.randomUUID()
        val execution = mock<DelegateExecution> {
            on { businessKey } doReturn documentId.toString()
        }
        whenever(buildingBlockInstanceService.getByDocumentId(documentId)).thenReturn(null)

        assertThatThrownBy { resolver.resolve(execution, "plugin-definition") }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No building block instance found for documentId")
    }

    @Test
    fun `should throw when multiple building block process links are found`() {
        val documentId = UUID.randomUUID()
        val testProcessDefinitionId = "case-process"
        val activityId = "callActivity"
        val execution = mock<DelegateExecution> {
            on { businessKey } doReturn documentId.toString()
            on { processDefinitionId } doReturn testProcessDefinitionId
        }
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId,
            "Test block",
            "desc",
            "tester",
            LocalDateTime.now(),
            null,
            false
        )
        whenever(buildingBlockInstanceService.getByDocumentId(documentId)).thenReturn(
            BuildingBlockInstance(
                documentId = documentId,
                caseDocumentId = UUID.randomUUID(),
                activityId = activityId,
                definition = definition
            )
        )

        val link = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = testProcessDefinitionId,
            activityId = activityId,
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = emptyList()
        )
        whenever(processLinkService.getProcessLinks(testProcessDefinitionId, activityId))
            .thenReturn(listOf(link, link.copy(id = UUID.randomUUID())))

        assertThatThrownBy { resolver.resolve(execution, "plugin-definition") }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining(testProcessDefinitionId)
            .hasMessageContaining(activityId)
    }
}
