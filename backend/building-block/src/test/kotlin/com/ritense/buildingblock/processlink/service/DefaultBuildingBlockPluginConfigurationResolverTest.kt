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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.time.LocalDateTime
import java.util.UUID

class DefaultBuildingBlockPluginConfigurationResolverTest {

    private val buildingBlockInstanceService = mock<BuildingBlockInstanceService>()
    private val processLinkService = mock<ProcessLinkService>()
    private val linkRepository = mock<com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository>()
    private val documentService = mock<com.ritense.document.service.DocumentService>()

    private val resolver = DefaultBuildingBlockPluginConfigurationResolver(
        buildingBlockInstanceService,
        processLinkService,
        linkRepository,
        documentService,
    )

    @Test
    fun `should resolve plugin configuration mapping via call activity`() {
        val bbProcessInstanceId = "bb-process-instance"
        val callerProcessDefinitionId = "case-process-def"
        val activityId = "callActivity"
        val pluginConfigurationId = UUID.randomUUID()
        val rootInstanceId = UUID.randomUUID()

        val execution = mock<DelegateExecution> {
            on { processInstanceId } doReturn bbProcessInstanceId
        }

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId, "Test block", "desc", "tester",
            LocalDateTime.now(), null, false
        )

        val rootInstance = BuildingBlockInstance(
            id = rootInstanceId,
            documentId = UUID.randomUUID(),
            caseDocumentId = UUID.randomUUID(),
            processInstanceId = "root-process-instance",

            activityId = activityId,
            callerProcessDefinitionId = callerProcessDefinitionId,
            definition = definition
        )

        whenever(buildingBlockInstanceService.getByProcessInstanceId(bbProcessInstanceId)).thenReturn(
            BuildingBlockInstance(
                documentId = UUID.randomUUID(),
                caseDocumentId = UUID.randomUUID(),
                processInstanceId = bbProcessInstanceId,

                rootBuildingBlockInstanceId = rootInstanceId,
                definition = definition
            )
        )
        whenever(buildingBlockInstanceService.get(rootInstanceId)).thenReturn(rootInstance)

        whenever(processLinkService.getProcessLinks(callerProcessDefinitionId, activityId)).thenReturn(
            listOf(
                BuildingBlockProcessLink(
                    id = UUID.randomUUID(),
                    processDefinitionId = callerProcessDefinitionId,
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
        verify(processLinkService).getProcessLinks(callerProcessDefinitionId, activityId)
    }

    @Test
    fun `should return null when no building block context found`() {
        val processInstanceId = UUID.randomUUID().toString()
        val execution = mock<DelegateExecution> {
            on { this.processInstanceId } doReturn processInstanceId
        }

        whenever(buildingBlockInstanceService.getByProcessInstanceId(processInstanceId)).thenReturn(null)

        val resolved = resolver.resolve(execution, "any")
        assertThat(resolved).isNull()
    }

    @Test
    fun `should resolve plugin via business key when called from sub-process inside a building block`() {
        // Scenario: BB main process started ad-hoc -> plain callActivity to a sub-process that has
        // a plugin process link. The sub-process has its own processInstanceId and no BB instance
        // row of its own; resolution must succeed via the business key (= BB document id) which the
        // call activity propagates per Valtimo convention.
        val subProcessInstanceId = "sub-process-instance"
        val buildingBlockDocumentId = UUID.randomUUID()
        val callerProcessDefinitionId = "case-process-def"
        val activityId = "callBB"
        val pluginConfigurationId = UUID.randomUUID()

        val execution = mock<DelegateExecution> {
            on { processInstanceId } doReturn subProcessInstanceId
            on { processBusinessKey } doReturn buildingBlockDocumentId.toString()
        }

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId, "Test block", "desc", "tester",
            LocalDateTime.now(), null, false
        )

        val bbInstance = BuildingBlockInstance(
            documentId = buildingBlockDocumentId,
            caseDocumentId = UUID.randomUUID(),
            processInstanceId = "bb-main-process-instance",
            activityId = activityId,
            callerProcessDefinitionId = callerProcessDefinitionId,
            definition = definition
        )

        // The sub-process has no row of its own; only the BB main process does.
        whenever(buildingBlockInstanceService.getByProcessInstanceId(subProcessInstanceId)).thenReturn(null)
        whenever(buildingBlockInstanceService.getByDocumentId(buildingBlockDocumentId)).thenReturn(bbInstance)

        whenever(processLinkService.getProcessLinks(callerProcessDefinitionId, activityId)).thenReturn(
            listOf(
                BuildingBlockProcessLink(
                    id = UUID.randomUUID(),
                    processDefinitionId = callerProcessDefinitionId,
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
    }

    @Test
    fun `should resolve from case link when no call activity mapping exists`() {
        val bbProcessInstanceId = "bb-process-instance"
        val caseDocumentId = UUID.randomUUID()
        val pluginConfigurationId = UUID.randomUUID()
        val mockCaseDefinitionId = mock<CaseDefinitionId>()

        val execution = mock<DelegateExecution> {
            on { processInstanceId } doReturn bbProcessInstanceId
        }

        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb-key", "1.0.0")
        val definition = BuildingBlockDefinition(
            buildingBlockDefinitionId, "Test block", "desc", "tester",
            LocalDateTime.now(), null, false
        )

        // Top-level ad-hoc BB (no activityId, no parent)
        whenever(buildingBlockInstanceService.getByProcessInstanceId(bbProcessInstanceId)).thenReturn(
            BuildingBlockInstance(
                documentId = UUID.randomUUID(),
                caseDocumentId = caseDocumentId,
                processInstanceId = bbProcessInstanceId,

                definition = definition
            )
        )

        val documentDefinitionId = mock<com.ritense.document.domain.DocumentDefinition.Id> {
            on { caseDefinitionId() } doReturn mockCaseDefinitionId
        }
        val caseDocument = mock<com.ritense.document.domain.Document> {
            on { definitionId() } doReturn documentDefinitionId
        }
        whenever(documentService.get(caseDocumentId.toString())).thenReturn(caseDocument)

        val link = mock<com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink> {
            on { pluginConfigurationMappings } doReturn mapOf("plugin-definition" to pluginConfigurationId)
        }
        whenever(linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(mockCaseDefinitionId, buildingBlockDefinitionId))
            .thenReturn(link)

        val resolved = resolver.resolve(execution, "plugin-definition")

        assertThat(resolved).isEqualTo(pluginConfigurationId)
    }
}
