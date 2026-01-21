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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchema
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
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.UUID

/**
 * Integration tests for DefaultBuildingBlockPluginConfigurationResolver.
 * Tests that plugin configurations are correctly resolved from the ROOT building block
 * even when called from deeply nested building blocks.
 */
@org.springframework.transaction.annotation.Transactional
class DefaultBuildingBlockPluginConfigurationResolverIT @Autowired constructor(
    private val listener: BuildingBlockCallActivityListener,
    private val resolver: DefaultBuildingBlockPluginConfigurationResolver,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    private lateinit var caseDefinitionId: CaseDefinitionId
    private lateinit var caseDocumentId: UUID

    private lateinit var bb1DefinitionId: BuildingBlockDefinitionId
    private lateinit var bb2DefinitionId: BuildingBlockDefinitionId

    private val pluginConfigurationId = UUID.randomUUID()

    @BeforeEach
    fun setup() {
        buildingBlockInstanceRepository.deleteAll()

        caseDefinitionId = CaseDefinitionId.of("plugin-test-case", "1.0.0")
        val caseSchema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "plugin-test-case.schema",
              "type": "object",
              "properties": {
                "data": {"type": "string"}
              }
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forCase("plugin-test-case", caseDefinitionId),
                JsonSchema.fromString(caseSchema)
            )
        )

        bb1DefinitionId = BuildingBlockDefinitionId.of("bb-with-plugin", "1.0.0")
        bb2DefinitionId = BuildingBlockDefinitionId.of("bb-nested", "1.0.0")

        listOf(bb1DefinitionId, bb2DefinitionId).forEach { id ->
            buildingBlockDefinitionRepository.save(
                BuildingBlockDefinition(
                    id = id,
                    name = "Test BB ${id.key}",
                    description = "Test building block",
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
                    "value": {"type": "string"}
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

        val caseContent = objectMapper.createObjectNode().apply {
            put("data", "test")
        }
        caseDocumentId = runWithoutAuthorization {
            val result = documentService.createDocument(
                NewDocumentRequest(
                    "plugin-test-case",
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
    fun `should resolve plugin configuration from root building block when in nested BB`() {
        // Setup: Case -> BB1 (with plugin config) -> BB2
        // The plugin config is defined on the BB1 process link (root BB)
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = mapOf("my-plugin" to pluginConfigurationId),
            inputMappings = emptyList()
        )

        val bb2ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "bb-with-plugin-process",
            activityId = "callBB2",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb2DefinitionId,
            pluginConfigurationMappings = emptyMap(), // No plugin config on nested BB
            inputMappings = emptyList()
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))
        whenever(processLinkService.getProcessLinks("bb-with-plugin-process", "callBB2")).thenReturn(listOf(bb2ProcessLink))

        // Create BB1 (from case)
        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString()
        )

        runWithoutAuthorization {
            listener.onCallActivityStart(bb1Execution)
        }

        val bb1Instance = buildingBlockInstanceRepository.findAll().first()

        // Create BB2 (from BB1)
        val bb2Execution = createMockExecution(
            processDefinitionId = "bb-with-plugin-process",
            activityId = "callBB2",
            businessKey = bb1Instance.documentId.toString()
        )

        runWithoutAuthorization {
            listener.onCallActivityStart(bb2Execution)
        }

        val bb2Instance = buildingBlockInstanceRepository.findAll().find { it.definition.id == bb2DefinitionId }!!

        // Now simulate being inside BB2 and resolving plugin config
        // The execution hierarchy: BB2 process -> BB1's call activity -> BB1 process -> Case's call activity -> Case process
        val bb1CallActivityExecution = mock<DelegateExecution> {
            on { hasVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn true
            on { getVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn bb1Instance.documentId.toString()
            on { processDefinitionId } doReturn "case-process"
            on { superExecution } doReturn null
        }

        val bb2CallActivityExecution = mock<DelegateExecution> {
            on { hasVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn true
            on { getVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn bb2Instance.documentId.toString()
            on { processDefinitionId } doReturn "bb-with-plugin-process"
            on { superExecution } doReturn bb1CallActivityExecution
        }

        val bb2ProcessExecution = mock<DelegateExecution> {
            on { hasVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn false
            on { superExecution } doReturn bb2CallActivityExecution
        }

        // Resolve plugin config from inside BB2 - should get config from root BB (BB1)
        val resolvedConfigId = resolver.resolve(bb2ProcessExecution, "my-plugin")

        assertThat(resolvedConfigId).isEqualTo(pluginConfigurationId)
    }

    @Test
    fun `should resolve plugin configuration from direct building block`() {
        // Setup: Case -> BB1 (with plugin config)
        val bb1ProcessLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callBB1",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = bb1DefinitionId,
            pluginConfigurationMappings = mapOf("my-plugin" to pluginConfigurationId),
            inputMappings = emptyList()
        )

        whenever(processLinkService.getProcessLinks("case-process", "callBB1")).thenReturn(listOf(bb1ProcessLink))

        // Create BB1 (from case)
        val bb1Execution = createMockExecution(
            processDefinitionId = "case-process",
            activityId = "callBB1",
            businessKey = caseDocumentId.toString()
        )

        runWithoutAuthorization {
            listener.onCallActivityStart(bb1Execution)
        }

        val bb1Instance = buildingBlockInstanceRepository.findAll().first()

        // Simulate being inside BB1 and resolving plugin config
        val bb1CallActivityExecution = mock<DelegateExecution> {
            on { hasVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn true
            on { getVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn bb1Instance.documentId.toString()
            on { processDefinitionId } doReturn "case-process"
            on { superExecution } doReturn null
        }

        val bb1ProcessExecution = mock<DelegateExecution> {
            on { hasVariableLocal(eq(BUILDING_BLOCK_DOCUMENT_ID_VARIABLE)) } doReturn false
            on { superExecution } doReturn bb1CallActivityExecution
        }

        // Resolve plugin config from inside BB1
        val resolvedConfigId = resolver.resolve(bb1ProcessExecution, "my-plugin")

        assertThat(resolvedConfigId).isEqualTo(pluginConfigurationId)
    }

    private fun createMockExecution(
        processDefinitionId: String,
        activityId: String,
        businessKey: String
    ): DelegateExecution {
        return mock {
            on { this.currentActivityId } doReturn activityId
            on { this.processDefinitionId } doReturn processDefinitionId
            on { this.businessKey } doReturn businessKey
            on { this.processBusinessKey } doReturn businessKey
        }
    }
}
