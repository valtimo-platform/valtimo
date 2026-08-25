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

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.authorization.AuthorizationContext
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.Callable

class BuildingBlockDocumentPreDeleteListenerIT : BaseIntegrationTest() {

    @Autowired
    lateinit var buildingBlockInstanceService: BuildingBlockInstanceService

    @Autowired
    lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository

    @Autowired
    lateinit var documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var processDocumentService: ProcessDocumentService

    @Autowired
    lateinit var processLinkRepository: ProcessLinkRepository

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var runtimeService: RuntimeService

    private val createdCaseDocumentIds = mutableListOf<UUID>()
    private val createdProcessLinkIds = mutableListOf<UUID>()

    @AfterEach
    fun deleteCreatedCases() {
        createdCaseDocumentIds.filter { findDocument(it) != null }.forEach { caseDocumentId ->
            AuthorizationContext.runWithoutAuthorization(Callable {
                documentService.deleteDocument(JsonSchemaDocumentId.existingId(caseDocumentId))
            })
        }
        createdCaseDocumentIds.clear()
        createdProcessLinkIds.forEach { processLinkRepository.deleteById(it) }
        createdProcessLinkIds.clear()
    }

    @Test
    fun `deleting a case should delete its building block instances and their documents`() {
        val definitionId = deployBuildingBlockDefinition()
        val caseDocumentId = createDocument(definitionId)
        val instance = createInstance(definitionId, caseDocumentId)
        val nestedInstance = createInstance(definitionId, caseDocumentId, instance.id)

        AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(caseDocumentId))
        })

        assertThat(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).isEmpty()
        assertThat(findDocument(caseDocumentId)).isNull()
        assertThat(findDocument(instance.documentId)).isNull()
        assertThat(findDocument(nestedInstance.documentId)).isNull()
    }

    @Test
    fun `deleting a case without building blocks should leave other cases untouched`() {
        val definitionId = deployBuildingBlockDefinition()
        val caseDocumentId = createDocument(definitionId)
        val otherCaseDocumentId = createDocument(definitionId)
        val instance = createInstance(definitionId, otherCaseDocumentId)

        AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(caseDocumentId))
        })

        assertThat(findDocument(caseDocumentId)).isNull()
        assertThat(buildingBlockInstanceRepository.findById(instance.id)).isPresent
        assertThat(findDocument(instance.documentId)).isNotNull
    }

    @Test
    fun `deleting a case should delete a building block whose process is still running`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val processLinkId = UUID.randomUUID()
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = processLinkId,
                processDefinitionId = mainProcessDefinitionId(),
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList()
            )
        )
        createdProcessLinkIds.add(processLinkId)

        val caseDocumentId = startCase()
        val instance = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).single()
        // The building block waits for a message, so its process is a running subprocess of the case's process
        assertThat(runningProcessInstanceCount(instance.documentId)).isOne()

        AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.deleteDocument(JsonSchemaDocumentId.existingId(caseDocumentId))
        })

        assertThat(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).isEmpty()
        assertThat(findDocument(caseDocumentId)).isNull()
        assertThat(findDocument(instance.documentId)).isNull()
        assertThat(runningProcessInstanceCount(caseDocumentId)).isZero()
        assertThat(runningProcessInstanceCount(instance.documentId)).isZero()
    }

    private fun startCase(): UUID = AuthorizationContext.runWithoutAuthorization(Callable {
        processDocumentService.newDocumentAndStartProcess(
            NewDocumentAndStartProcessRequest(
                MAIN_PROCESS_KEY,
                NewDocumentRequest(
                    CASE_DOCUMENT_DEFINITION_NAME,
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_VERSION,
                    JsonNodeFactory.instance.objectNode()
                )
            )
        ).resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created") }
            .id()
            .getId()
    }).also { createdCaseDocumentIds.add(it) }

    private fun mainProcessDefinitionId(): String =
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?.id
            ?: throw IllegalStateException("Process definition '$MAIN_PROCESS_KEY' not deployed")

    private fun runningProcessInstanceCount(businessKey: UUID) =
        runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(businessKey.toString())
            .count()

    private fun deployBuildingBlockDefinition(): BuildingBlockDefinitionId {
        val buildingBlockKey = "bezwaar-${UUID.randomUUID().toString().take(8)}"
        val definitionId = BuildingBlockDefinitionId.of(buildingBlockKey, "1.0.0")
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(
                id = definitionId,
                name = "Bezwaar block",
                description = "description",
                createdBy = "tester",
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = null,
                final = false
            )
        )

        val documentDefinitionName = "$buildingBlockKey-document"
        val schema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "$documentDefinitionName.schema",
              "type": "object",
              "properties": {}
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forBuildingBlock(documentDefinitionName, definitionId),
                JsonSchema.fromString(schema)
            )
        )

        return definitionId
    }

    private fun newDocumentRequest(definitionId: BuildingBlockDefinitionId, type: String) = NewDocumentRequest(
        "${definitionId.key}-document",
        null,
        null,
        definitionId.key,
        definitionId.versionTag.toString(),
        JsonNodeFactory.instance.objectNode().put("type", type)
    )

    private fun createDocument(definitionId: BuildingBlockDefinitionId): UUID =
        AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.createDocument(newDocumentRequest(definitionId, "case"))
                .resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }).also { createdCaseDocumentIds.add(it) }

    private fun createInstance(
        definitionId: BuildingBlockDefinitionId,
        caseDocumentId: UUID,
        parentBuildingBlockInstanceId: UUID? = null
    ): BuildingBlockInstance = AuthorizationContext.runWithoutAuthorization(Callable {
        buildingBlockInstanceService.create(
            newDocumentRequest(definitionId, "building-block"),
            caseDocumentId,
            "call-activity",
            parentBuildingBlockInstanceId
        )
    })

    private fun findDocument(documentId: UUID) = AuthorizationContext.runWithoutAuthorization(Callable {
        documentService.findBy(JsonSchemaDocumentId.existingId(documentId)).orElse(null)
    })

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DOCUMENT_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "building-block-call-activity-main"
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
