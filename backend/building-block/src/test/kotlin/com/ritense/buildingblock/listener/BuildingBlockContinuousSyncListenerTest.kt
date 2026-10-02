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

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.document.domain.Document
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.domain.event.DocumentModifiedEvent
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
import java.time.LocalDateTime
import java.util.UUID

class BuildingBlockContinuousSyncListenerTest {

    private val buildingBlockInstanceService = mock<BuildingBlockInstanceService>()
    private val processLinkService = mock<ProcessLinkService>()
    private val caseDefinitionBuildingBlockLinkService = mock<CaseDefinitionBuildingBlockLinkService>()
    private val documentService = mock<DocumentService>()
    private val valueResolverService = mock<ValueResolverService>()
    private val runtimeService = mock<RuntimeService>()

    private val listener = BuildingBlockContinuousSyncListener(
        buildingBlockInstanceService,
        processLinkService,
        caseDefinitionBuildingBlockLinkService,
        documentService,
        valueResolverService,
        runtimeService,
    )

    @Test
    fun `should ignore documents that are not building block documents`() {
        val documentId = UUID.randomUUID()
        whenever(buildingBlockInstanceService.getByDocumentId(documentId)).thenReturn(null)

        listener.onDocumentModified(modifiedEvent(documentId))

        verifyNoInteractions(
            processLinkService,
            caseDefinitionBuildingBlockLinkService,
            documentService,
            valueResolverService,
            runtimeService,
        )
    }

    @Test
    fun `should continuously sync doc target to case document for call activity building block`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = caseDocumentId,
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = BB_PROCESS_INSTANCE_ID,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "doc:/resultFromBb",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))
        whenever(valueResolverService.resolveValues(bbDocumentId.toString(), listOf("doc:beslissingBezwaar")))
            .thenReturn(mapOf("doc:beslissingBezwaar" to "approved"))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verify(valueResolverService).handleValues(caseDocumentId, mapOf("doc:/resultFromBb" to "approved"))
    }

    @Test
    fun `should skip continuous mappings whose source resolves to null`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = caseDocumentId,
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = BB_PROCESS_INSTANCE_ID,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "alreadySet",
                target = "doc:/synced",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            ),
            BuildingBlockOutputMapping(
                source = "notYetSet",
                target = "doc:/skipped",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))
        whenever(
            valueResolverService.resolveValues(
                bbDocumentId.toString(),
                listOf("doc:alreadySet", "doc:notYetSet")
            )
        ).thenReturn(mapOf("doc:alreadySet" to "value", "doc:notYetSet" to null))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        // Only the non-null mapping is written; the null one is omitted (no null write).
        verify(valueResolverService).handleValues(caseDocumentId, mapOf("doc:/synced" to "value"))
    }

    @Test
    fun `should continuously sync doc target to parent building block document when nested`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val parentInstanceId = UUID.randomUUID()
        val parentBbDocumentId = UUID.randomUUID()

        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = caseDocumentId,
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = BB_PROCESS_INSTANCE_ID,
            parentBuildingBlockInstanceId = parentInstanceId,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)
        whenever(buildingBlockInstanceService.get(parentInstanceId)).thenReturn(
            BuildingBlockInstance(
                id = parentInstanceId,
                documentId = parentBbDocumentId,
                caseDocumentId = caseDocumentId,
                definition = definition("parent-bb"),
            )
        )

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "doc:/resultFromBb",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))
        whenever(valueResolverService.resolveValues(bbDocumentId.toString(), listOf("doc:beslissingBezwaar")))
            .thenReturn(mapOf("doc:beslissingBezwaar" to "approved"))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verify(valueResolverService).handleValues(parentBbDocumentId, mapOf("doc:/resultFromBb" to "approved"))
    }

    @Test
    fun `should not sync when call activity building block only has end mappings`() {
        val bbDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = UUID.randomUUID(),
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = BB_PROCESS_INSTANCE_ID,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "doc:/resultFromBb",
                syncTiming = BuildingBlockSyncTiming.END
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verifyNoInteractions(valueResolverService)
    }

    @Test
    fun `should continuously sync pv target to caller process instance`() {
        val bbDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = UUID.randomUUID(),
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = BB_PROCESS_INSTANCE_ID,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "pv:result",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))
        whenever(valueResolverService.resolveValues(bbDocumentId.toString(), listOf("doc:beslissingBezwaar")))
            .thenReturn(mapOf("doc:beslissingBezwaar" to "approved"))

        val callerProcessInstance = mock<ProcessInstance> { on { id } doReturn CALLER_PROCESS_INSTANCE_ID }
        val query = mock<ProcessInstanceQuery>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.subProcessInstanceId(BB_PROCESS_INSTANCE_ID)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(callerProcessInstance)

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verify(valueResolverService).handleValues(
            eq(CALLER_PROCESS_INSTANCE_ID),
            isNull(),
            eq(mapOf("pv:result" to "approved"))
        )
    }

    @Test
    fun `should skip pv sync when building block process has not started`() {
        val bbDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = UUID.randomUUID(),
            activityId = ACTIVITY_ID,
            callerProcessDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            processInstanceId = null,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val processLink = processLink(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "pv:result",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )
        whenever(processLinkService.getProcessLinks(CALLER_PROCESS_DEFINITION_ID, ACTIVITY_ID))
            .thenReturn(listOf(processLink))
        whenever(valueResolverService.resolveValues(bbDocumentId.toString(), listOf("doc:beslissingBezwaar")))
            .thenReturn(mapOf("doc:beslissingBezwaar" to "approved"))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verify(valueResolverService, never()).handleValues(any<String>(), anyOrNull(), any())
        verify(valueResolverService, never()).handleValues(any<UUID>(), any())
        verifyNoInteractions(runtimeService)
    }

    @Test
    fun `should continuously sync ad-hoc building block to case document`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = caseDocumentId,
            callerProcessDefinitionId = null,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val caseDefinitionId = CaseDefinitionId.of("bb-case", "1.0.0")
        val caseDocument = caseDocument(caseDefinitionId)
        whenever(documentService.get(caseDocumentId.toString())).thenReturn(caseDocument)
        whenever(
            caseDefinitionBuildingBlockLinkService.findLink(caseDefinitionId, instance.definition.id)
        ).thenReturn(
            link(
                caseDefinitionId,
                instance.definition.id,
                BuildingBlockOutputMapping(
                    source = "doc:/beslissingBezwaar",
                    target = "doc:/resultFromBb",
                    syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                )
            )
        )
        whenever(valueResolverService.resolveValues(bbDocumentId.toString(), listOf("doc:/beslissingBezwaar")))
            .thenReturn(mapOf("doc:/beslissingBezwaar" to "approved"))

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verify(valueResolverService).handleValues(caseDocumentId, mapOf("doc:/resultFromBb" to "approved"))
    }

    @Test
    fun `should not sync ad-hoc building block without a case definition link`() {
        val bbDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        val instance = BuildingBlockInstance(
            documentId = bbDocumentId,
            caseDocumentId = caseDocumentId,
            callerProcessDefinitionId = null,
            definition = definition(),
        )
        whenever(buildingBlockInstanceService.getByDocumentId(bbDocumentId)).thenReturn(instance)

        val caseDefinitionId = CaseDefinitionId.of("bb-case", "1.0.0")
        val caseDocument = caseDocument(caseDefinitionId)
        whenever(documentService.get(caseDocumentId.toString())).thenReturn(caseDocument)
        whenever(caseDefinitionBuildingBlockLinkService.findLink(caseDefinitionId, instance.definition.id))
            .thenReturn(null)

        listener.onDocumentModified(modifiedEvent(bbDocumentId))

        verifyNoInteractions(valueResolverService)
    }

    private fun modifiedEvent(documentId: UUID): DocumentModifiedEvent = mock {
        on { documentId() } doReturn JsonSchemaDocumentId.existingId(documentId)
    }

    private fun caseDocument(caseDefinitionId: CaseDefinitionId): Document {
        val definitionId = mock<DocumentDefinition.Id> {
            on { caseDefinitionId() } doReturn caseDefinitionId
        }
        return mock { on { definitionId() } doReturn definitionId }
    }

    private fun definition(key: String = "bezwaar", version: String = "1.0.0"): BuildingBlockDefinition =
        BuildingBlockDefinition(
            BuildingBlockDefinitionId.of(key, version),
            "Test block",
            "desc",
            "tester",
            LocalDateTime.now(),
            null,
            false
        )

    private fun processLink(vararg outputMappings: BuildingBlockOutputMapping): BuildingBlockProcessLink =
        BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = CALLER_PROCESS_DEFINITION_ID,
            activityId = ACTIVITY_ID,
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bezwaar", "1.0.0"),
            pluginConfigurationMappings = emptyMap(),
            inputMappings = emptyList(),
            outputMappings = outputMappings.toList()
        )

    private fun link(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        vararg outputMappings: BuildingBlockOutputMapping
    ): CaseDefinitionBuildingBlockLink =
        CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            inputMappings = emptyList(),
            outputMappings = outputMappings.toList()
        )

    private companion object {
        private const val ACTIVITY_ID = "callActivity"
        private const val CALLER_PROCESS_DEFINITION_ID = "case-process:1:abc"
        private const val BB_PROCESS_INSTANCE_ID = "bb-process-instance"
        private const val CALLER_PROCESS_INSTANCE_ID = "caller-process-instance"
    }
}
