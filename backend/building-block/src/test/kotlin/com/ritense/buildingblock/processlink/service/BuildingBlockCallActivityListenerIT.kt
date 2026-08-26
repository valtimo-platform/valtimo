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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.processlink.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.buildingblock.TestMailPlugin
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class BuildingBlockCallActivityListenerIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val processLinkRepository: ProcessLinkRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val valueResolverService: ValueResolverService,
) : BaseIntegrationTest() {

    @Test
    fun `should create building block document with resolved case data`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        val caseContent = objectMapper.createObjectNode().apply {
            putObject("contact").apply {
                put("firstName", "Ada")
                put("lastName", "Lovelace")
            }
        }

        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "doc:/contact/firstName",
                target = "voornaam"
            ),
            BuildingBlockInputMapping(
                source = "doc:/contact/lastName",
                target = "achternaam"
            ),
        )
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = inputMappings
            )
        )

        val caseDocumentId = startCase(caseContent)

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(buildingBlockDefinitionId)

        val buildingBlockDocument = runWithoutAuthorization {
            documentService.get(instance.documentId.toString())
        } as JsonSchemaDocument
        val content = buildingBlockDocument.content().asJson()
        assertThat(content.get("voornaam").asText()).isEqualTo("Ada")
        assertThat(content.get("achternaam").asText()).isEqualTo("Lovelace")

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should resolve input mapped attachment list from within the building block process context`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        // Resource-ids as stored by e.g. document generation in the temporary resource storage
        val attachmentIds = listOf(UUID.randomUUID().toString(), UUID.randomUUID().toString())
        val caseContent = objectMapper.createObjectNode().apply {
            putArray("attachments").apply { attachmentIds.forEach { add(it) } }
        }

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = listOf(
                    BuildingBlockInputMapping(
                        source = "doc:/attachments",
                        target = "bijlagen"
                    )
                )
            )
        )

        startCase(caseContent)

        val instance = buildingBlockInstanceRepository.findAll().single()

        // The building block process runs with businessKey == building block document id
        val bbProcessInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(instance.documentId.toString())
            .singleResult()
        assertThat(bbProcessInstance).isNotNull

        // Resolve the same way PluginService resolves action properties for a service task inside
        // the building block process: by processInstanceId and a scope without process variables.
        val scopeWithoutVariables = mock<DelegateExecution>()
        val resolved = runWithoutAuthorization {
            valueResolverService.resolveValues(
                bbProcessInstance.id,
                scopeWithoutVariables,
                listOf("doc:/bijlagen", "pv:attachmentIds")
            )
        }

        assertThat(resolved["doc:/bijlagen"]).isEqualTo(attachmentIds)
        // Values mapped into the building block only exist in its document, not as process variables
        assertThat(resolved["pv:attachmentIds"]).isNull()

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should pass building block field values to a plugin action inside the building block process`() {
        TestMailPlugin.reset()
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        val attachmentIds = listOf(UUID.randomUUID().toString(), UUID.randomUUID().toString())
        val caseContent = objectMapper.createObjectNode().apply {
            putArray("attachments").apply { attachmentIds.forEach { add(it) } }
        }

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = mapOf(
                    TEST_MAIL_PLUGIN_KEY to UUID.fromString(TEST_MAIL_PLUGIN_CONFIGURATION_ID)
                ),
                inputMappings = listOf(
                    BuildingBlockInputMapping(
                        source = "doc:/attachments",
                        target = "bijlagen"
                    )
                )
            )
        )

        // The plugin action on the service task inside the building block process, configured like
        // the SMTP mail plugin: a doc: reference for the attachments, a pv: reference for the content
        processLinkRepository.save(
            PluginProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId(SUB_PROCESS_KEY),
                activityId = SEND_MAIL_TASK_ID,
                activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
                actionProperties = objectMapper.createObjectNode()
                    .put("attachmentIds", "doc:/bijlagen")
                    .put("contentId", "pv:contentId"),
                pluginConfigurationReference = PluginConfigurationReference(
                    PluginConfigurationReferenceType.BUILDING_BLOCK,
                    TEST_MAIL_PLUGIN_KEY
                ),
                pluginActionDefinitionKey = "send-mail"
            )
        )

        startCase(caseContent)

        // The attachment list mapped into the building block document reached the plugin action
        assertThat(TestMailPlugin.invoked).isTrue()
        assertThat(TestMailPlugin.receivedAttachmentIds).isEqualTo(attachmentIds)
        // A pv: reference inside a building block resolves to null: mapped values only exist in its document
        assertThat(TestMailPlugin.receivedContentId).isNull()

        val instance = buildingBlockInstanceRepository.findAll().single()
        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should fail the call activity when the business key mapping is wrong`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId(WRONG_KEY_PROCESS_KEY),
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap()
            )
        )

        val caseDocumentId = createCaseDocument()

        assertThatThrownBy {
            runWithoutAuthorization {
                runtimeService.startProcessInstanceByKey(WRONG_KEY_PROCESS_KEY, caseDocumentId.toString())
            }
        }
            .hasStackTraceContaining("must map the business key to #{buildingBlockDocumentId}")
            .hasStackTraceContaining("#{execution.processBusinessKey}")

        // The call activity fails before any building block state is created
        assertThat(buildingBlockInstanceRepository.findAll()).isEmpty()
    }

    @Test
    fun `should fail the call activity when the business key mapping is shadowed by operaton namespace elements`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId(DUAL_NS_PROCESS_KEY),
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap()
            )
        )

        val caseDocumentId = createCaseDocument()

        // The correct <camunda:in businessKey> is present but ignored by the engine, because the
        // call activity also has an <operaton:in> element; the error must explain the shadowing
        assertThatThrownBy {
            runWithoutAuthorization {
                runtimeService.startProcessInstanceByKey(DUAL_NS_PROCESS_KEY, caseDocumentId.toString())
            }
        }
            .hasStackTraceContaining("'#{execution.processBusinessKey}'")
            .hasStackTraceContaining("<operaton:in>")

        assertThat(buildingBlockInstanceRepository.findAll()).isEmpty()
    }

    @Test
    fun `should write output mappings to case document on call activity end`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val caseContent = objectMapper.createObjectNode()

        val outputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "doc:/resultFromBb",
                syncTiming = BuildingBlockSyncTiming.END
            ),
        )
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = outputMappings
            )
        )

        val caseDocumentId = startCase(caseContent)

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()

        runWithoutAuthorization {
            val buildingBlockDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = buildingBlockDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(buildingBlockDocument, updatedContent)
        }

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())

        val updatedCaseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        val content = updatedCaseDocument.content().asJson()
        assertThat(content.get("resultFromBb").asText()).isEqualTo("approved")
    }

    private fun createCaseDocument(): UUID {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    CASE_DOCUMENT_DEFINITION_NAME,
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_VERSION,
                    objectMapper.createObjectNode()
                )
            ).resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }
    }

    private fun startCase(caseContent: ObjectNode, processKey: String = MAIN_PROCESS_KEY): UUID {
        val request = NewDocumentAndStartProcessRequest(
            processKey,
            NewDocumentRequest(
                CASE_DOCUMENT_DEFINITION_NAME,
                CASE_DEFINITION_KEY,
                CASE_DEFINITION_VERSION,
                caseContent
            )
        )
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(request)
        }
        return result.resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created") }
            .id()
            .getId()
    }

    private fun processDefinitionId(processKey: String = MAIN_PROCESS_KEY): String {
        val definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processKey)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$processKey' not deployed")
        return definition.id
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DOCUMENT_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "building-block-call-activity-main"
        private const val WRONG_KEY_PROCESS_KEY = "building-block-call-activity-main-wrong-key"
        private const val DUAL_NS_PROCESS_KEY = "building-block-call-activity-main-dual-ns"
        private const val SUB_PROCESS_KEY = "building-block-process"
        private const val CALL_ACTIVITY_ID = "callActivity"
        private const val SEND_MAIL_TASK_ID = "SendMailTask"
        private const val TEST_MAIL_PLUGIN_KEY = "test-mail-plugin"
        private const val TEST_MAIL_PLUGIN_CONFIGURATION_ID = "3f1b5aa8-6b34-4bfe-9f78-3f1d8f2a1a01"
    }
}
