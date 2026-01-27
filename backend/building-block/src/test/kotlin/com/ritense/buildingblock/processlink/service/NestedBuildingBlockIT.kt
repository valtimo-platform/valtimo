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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.buildingblock.BuildingBlockConstants.Companion.BUILDING_BLOCK_DOCUMENT_ID_VARIABLE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.Callable

/**
 * Integration tests for nested building blocks.
 * Tests that building blocks can be nested multiple levels deep (A -> B -> C),
 * with correct tracking of caseDocumentId and parentBuildingBlockInstanceId.
 */
@org.springframework.transaction.annotation.Transactional
class NestedBuildingBlockIT @Autowired constructor(
    private val listener: BuildingBlockCallActivityListener,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    private lateinit var caseDefinitionId: CaseDefinitionId
    private lateinit var caseDocumentId: UUID

    private lateinit var bb1DefinitionId: BuildingBlockDefinitionId
    private lateinit var bb2DefinitionId: BuildingBlockDefinitionId
    private lateinit var bb3DefinitionId: BuildingBlockDefinitionId

    @BeforeEach
    fun setup() {
        // Clean up any leftover instances from previous tests
        buildingBlockInstanceRepository.deleteAll()

        // Create case definition and document
        caseDefinitionId = CaseDefinitionId.of("nested-test-case", "1.0.0")
        val caseSchema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "nested-test-case.schema",
              "type": "object",
              "properties": {
                "initialValue": {"type": "string"},
                "level": {"type": "integer"}
              }
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forCase("nested-test-case", caseDefinitionId),
                JsonSchema.fromString(caseSchema)
            )
        )

        // Create three building block definitions (for 3 levels of nesting)
        bb1DefinitionId = BuildingBlockDefinitionId.of("bb-level-1", "1.0.0")
        bb2DefinitionId = BuildingBlockDefinitionId.of("bb-level-2", "1.0.0")
        bb3DefinitionId = BuildingBlockDefinitionId.of("bb-level-3", "1.0.0")

        listOf(
            Triple(bb1DefinitionId, "Building Block Level 1", "First level building block"),
            Triple(bb2DefinitionId, "Building Block Level 2", "Second level (nested) building block"),
            Triple(bb3DefinitionId, "Building Block Level 3", "Third level (deeply nested) building block")
        ).forEach { (id, name, description) ->
            buildingBlockDefinitionRepository.save(
                BuildingBlockDefinition(
                    id = id,
                    name = name,
                    description = description,
                    createdBy = "tester",
                    createdDate = LocalDateTime.now(),
                )
            )

            val bbSchema = """
                {
                  "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                  "${'$'}id": "${id.key}.schema",
                  "type": "object",
                  "properties": {
                    "processedValue": {"type": "string"},
                    "level": {"type": "integer"}
                  }
                }
            """.trimIndent()
            documentDefinitionRepository.saveAndFlush(
                JsonSchemaDocumentDefinition(
                    JsonSchemaDocumentDefinitionId.forBuildingBlock(id.key, id),
                    JsonSchema.fromString(bbSchema)
                )
            )
        }

        // Create case document
        val caseContent = objectMapper.createObjectNode().apply {
            put("initialValue", "test-data")
            put("level", 0)
        }
        caseDocumentId = runWithoutAuthorization {
            val result = documentService.createDocument(
                NewDocumentRequest(
                    "nested-test-case",
                    caseDefinitionId.key,
                    caseDefinitionId.versionTag.toString(),
                    caseContent
                )
            )
            result.resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }
    }

    @Test
    fun `should create nested building blocks with correct parent chain`() {
        // Setup: Case process -> BB1 -> BB2 -> BB3
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/initialValue", target = "processedValue"),
                BuildingBlockInputMapping(source = "doc:/level", target = "level")
            )
        )

        val bb2ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "bb-level-1-process",
            activityId = "callBB2",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb2DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/processedValue", target = "processedValue"),
                BuildingBlockInputMapping(source = "doc:/level", target = "level")
            )
        )

        val bb3ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "bb-level-2-process",
            activityId = "callBB3",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb3DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/processedValue", target = "processedValue"),
                BuildingBlockInputMapping(source = "doc:/level", target = "level")
            )
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))
        whenever(processLinkService.getProcessLinks("bb-level-1-process", "callBB2")).thenReturn(listOf(bb2ProcessLink))
        whenever(processLinkService.getProcessLinks("bb-level-2-process", "callBB3")).thenReturn(listOf(bb3ProcessLink))

        // Execute: Create first building block (from case)
        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString(),
            parentCallActivityExecution = null
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb1Execution)
        })

        // Verify BB1 was created
        var allInstances = buildingBlockInstanceRepository.findAll()
        assertThat(allInstances).hasSize(1)
        val bb1Instance = allInstances.first()
        assertThat(bb1Instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(bb1Instance.parentBuildingBlockInstanceId).isNull()
        assertThat(bb1Instance.definition.id).isEqualTo(bb1DefinitionId)

        // Execute: Create second building block (from BB1)
        val bb2Execution = createMockExecution(
            processDefinitionId = "bb-level-1-process",
            activityId = "callBB2",
            businessKey = bb1Instance.documentId.toString(),
            parentCallActivityExecution = createParentCallActivityExecution(bb1Instance.documentId)
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb2Execution)
        })

        // Verify BB2 was created with correct parent reference
        allInstances = buildingBlockInstanceRepository.findAll()
        assertThat(allInstances).hasSize(2)
        val bb2Instance = allInstances.find { it.definition.id == bb2DefinitionId }!!
        assertThat(bb2Instance.caseDocumentId).isEqualTo(caseDocumentId) // Should still point to root case
        assertThat(bb2Instance.parentBuildingBlockInstanceId).isEqualTo(bb1Instance.id)

        // Execute: Create third building block (from BB2)
        val bb3Execution = createMockExecution(
            processDefinitionId = "bb-level-2-process",
            activityId = "callBB3",
            businessKey = bb2Instance.documentId.toString(),
            parentCallActivityExecution = createParentCallActivityExecution(bb2Instance.documentId)
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb3Execution)
        })

        // Verify BB3 was created with correct parent reference
        allInstances = buildingBlockInstanceRepository.findAll()
        assertThat(allInstances).hasSize(3)
        val bb3Instance = allInstances.find { it.definition.id == bb3DefinitionId }!!
        assertThat(bb3Instance.caseDocumentId).isEqualTo(caseDocumentId) // Should still point to root case
        assertThat(bb3Instance.parentBuildingBlockInstanceId).isEqualTo(bb2Instance.id)

        // Verify all instances have the correct caseDocumentId (query can use this to find all BB instances for a case)
        val allInstancesForCase = allInstances.filter { it.caseDocumentId == caseDocumentId }
        assertThat(allInstancesForCase).hasSize(3)
        assertThat(allInstancesForCase.map { it.definition.id.key }).containsExactlyInAnyOrder(
            "bb-level-1", "bb-level-2", "bb-level-3"
        )
    }

    @Test
    fun `should correctly pass input mappings from parent building block document`() {
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/initialValue", target = "processedValue")
            )
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))

        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString(),
            parentCallActivityExecution = null
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb1Execution)
        })

        val bb1Instance = buildingBlockInstanceRepository.findAll().first()
        val bb1Document = AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.get(bb1Instance.documentId.toString())
        }) as JsonSchemaDocument

        // Verify BB1 document was created (input mappings resolve values from case document)
        val content = bb1Document.content().asJson()
        // The processedValue should be set from the case document's initialValue
        val processedValue = content.get("processedValue")
        assertThat(processedValue).isNotNull()
        assertThat(processedValue.asText()).isEqualTo("test-data")
    }

    @Test
    fun `should write output mappings to parent building block document when nested BB completes`() {
        // Setup: Case -> BB1, then we'll complete BB2 which writes to BB1's document
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/initialValue", target = "processedValue")
            )
        )

        // BB2 has output mappings that should write to BB1's document (not case document)
        val bb2ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "bb-level-1-process",
            activityId = "callBB2",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb2DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/processedValue", target = "processedValue")
            ),
            outputMappings = listOf(
                BuildingBlockOutputMapping(
                    source = "doc:/processedValue",
                    target = "doc:/processedValue",
                    syncTiming = BuildingBlockSyncTiming.END
                )
            )
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))
        whenever(processLinkService.getProcessLinks("bb-level-1-process", "callBB2")).thenReturn(listOf(bb2ProcessLink))

        // Create BB1 (from case)
        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString(),
            parentCallActivityExecution = null
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb1Execution)
        })

        val bb1Instance = buildingBlockInstanceRepository.findAll().first()

        // Create BB2 (from BB1)
        val bb2Execution = createMockExecution(
            processDefinitionId = "bb-level-1-process",
            activityId = "callBB2",
            businessKey = bb1Instance.documentId.toString(),
            parentCallActivityExecution = createParentCallActivityExecution(bb1Instance.documentId)
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb2Execution)
        })

        val bb2Instance = buildingBlockInstanceRepository.findAll().find { it.definition.id == bb2DefinitionId }!!

        // Update BB2 document with a result value
        val bb2UpdatedValue = "processed-by-bb2"
        AuthorizationContext.runWithoutAuthorization(Callable {
            val bb2Document = documentService.get(bb2Instance.documentId.toString())
            documentService.modifyDocument(
                bb2Document,
                objectMapper.createObjectNode().apply { put("processedValue", bb2UpdatedValue) }
            )
        })

        // Now complete BB2 - should write to BB1's document (not case document)
        val bb2EndExecution = createCallActivityEndExecution(
            processDefinitionId = "bb-level-1-process",
            buildingBlockDocumentId = bb2Instance.documentId
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityEnd(bb2EndExecution)
        })

        // Verify BB1's document was updated (not the case document)
        val bb1Document = AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.get(bb1Instance.documentId.toString())
        }) as JsonSchemaDocument
        assertThat(bb1Document.content().asJson().get("processedValue").asText()).isEqualTo(bb2UpdatedValue)

        // Verify case document was NOT updated
        val caseDocument = AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.get(caseDocumentId.toString())
        }) as JsonSchemaDocument
        assertThat(caseDocument.content().asJson().get("initialValue").asText()).isEqualTo("test-data")
    }

    @Test
    fun `should write output mappings to case document when top-level BB completes`() {
        // Create a case schema that can receive the output
        val updatedCaseSchema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "nested-test-case.schema",
              "type": "object",
              "properties": {
                "initialValue": {"type": "string"},
                "level": {"type": "integer"},
                "resultFromBB": {"type": "string"}
              }
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forCase("nested-test-case", caseDefinitionId),
                JsonSchema.fromString(updatedCaseSchema)
            )
        )

        // BB1 has output mappings that should write to case document
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = listOf(
                BuildingBlockInputMapping(source = "doc:/initialValue", target = "processedValue")
            ),
            outputMappings = listOf(
                BuildingBlockOutputMapping(
                    source = "doc:/processedValue",
                    target = "doc:/resultFromBB",
                    syncTiming = BuildingBlockSyncTiming.END
                )
            )
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))

        // Create BB1 (from case)
        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString(),
            parentCallActivityExecution = null
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(bb1Execution)
        })

        val bb1Instance = buildingBlockInstanceRepository.findAll().first()

        // Update BB1 document with a result value
        val bb1ResultValue = "result-from-bb1"
        AuthorizationContext.runWithoutAuthorization(Callable {
            val bb1Document = documentService.get(bb1Instance.documentId.toString())
            documentService.modifyDocument(
                bb1Document,
                objectMapper.createObjectNode().apply { put("processedValue", bb1ResultValue) }
            )
        })

        // Now complete BB1 - should write to case document
        val bb1EndExecution = createCallActivityEndExecution(
            processDefinitionId = "case-process",
            buildingBlockDocumentId = bb1Instance.documentId
        )

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityEnd(bb1EndExecution)
        })

        // Verify case document was updated
        val caseDocument = AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.get(caseDocumentId.toString())
        }) as JsonSchemaDocument
        assertThat(caseDocument.content().asJson().get("resultFromBB").asText()).isEqualTo(bb1ResultValue)
    }

    private fun createMockExecution(
        processDefinitionId: String,
        activityId: String,
        businessKey: String,
        parentCallActivityExecution: DelegateExecution?
    ): DelegateExecution {
        // Create a mock process instance (root execution)
        // The process instance's superExecution points to the call activity that started this process
        val processInstance: DelegateExecution = mock {
            on { superExecution } doReturn parentCallActivityExecution
        }

        return mock {
            on { this.currentActivityId } doReturn activityId
            on { this.processDefinitionId } doReturn processDefinitionId
            on { this.businessKey } doReturn businessKey
            on { this.processBusinessKey } doReturn businessKey  // Used by findParentBuildingBlockInstance
            on { this.processInstance } doReturn processInstance
        }
    }

    private fun createCallActivityEndExecution(
        processDefinitionId: String,
        buildingBlockDocumentId: UUID
    ): DelegateExecution {
        // This represents the call activity execution when the building block process ends
        // The local variable was set when the building block started
        return mock {
            on { this.processDefinitionId } doReturn processDefinitionId
            on { getVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE) } doReturn buildingBlockDocumentId.toString()
        }
    }

    private fun createParentCallActivityExecution(buildingBlockDocumentId: UUID): DelegateExecution {
        // This represents the call activity execution in the parent process
        // It has the BUILDING_BLOCK_DOCUMENT_ID_VARIABLE set as a local variable
        val parentProcessInstance: DelegateExecution = mock {
            on { superExecution } doReturn null
        }
        return mock {
            on { getVariableLocal(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE) } doReturn buildingBlockDocumentId.toString()
            on { processInstance } doReturn parentProcessInstance
        }
    }
}
