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

package com.ritense.formflow.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.formflow.BaseIntegrationTest
import com.ritense.formflow.FormFlowTaskOpenResultProperties
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.domain.instance.FormFlowInstanceId
import com.ritense.formflow.web.rest.FormFlowResource
import com.ritense.formflow.web.rest.dto.FormFlowProcessLinkCreateRequestDto
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkActivityService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.resource.domain.TemporaryResourceSubmittedEvent
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper
import com.ritense.valtimo.service.OperatonTaskService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * A form flow adds the files that were uploaded in it to the case when the flow ends, the same way a form does when
 * it is submitted.
 */
@Transactional
@Import(FormFlowUploadFieldIntTest.SubmittedResourceListenerConfiguration::class)
internal class FormFlowUploadFieldIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processDocumentService: ProcessDocumentService

    @Autowired
    lateinit var processLinkService: ProcessLinkService

    @Autowired
    lateinit var taskService: OperatonTaskService

    @Autowired
    lateinit var formFlowService: FormFlowService

    @Autowired
    lateinit var formFlowResource: FormFlowResource

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var processLinkActivityService: ProcessLinkActivityService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var submittedResourceListener: SubmittedResourceListener

    val caseDefinitionId = CaseDefinitionId("profile", "1.0.0")

    @BeforeEach
    fun beforeEach() {
        submittedResourceListener.events.clear()
    }

    @Test
    fun `should submit an uploaded file to the case when the form flow ends`() {
        val formFlowInstance = startFormFlowWithUploadField()
        val documentId = UUID.fromString(formFlowInstance.getAdditionalProperties()["documentId"] as String)
        val resourceId = "1234567890"

        completeCurrentStep(formFlowInstance, """{"bijlagen": [{"id": "$resourceId"}]}""")

        assertThat(submittedResourceListener.events).singleElement().satisfies({ event ->
            assertThat(event.resourceId).isEqualTo(resourceId)
            assertThat(event.documentId).isEqualTo(documentId)
        })
    }

    @Test
    fun `should not submit anything when the form flow has no uploaded files`() {
        val formFlowInstance = startFormFlowWithUploadField()

        completeCurrentStep(formFlowInstance, """{"voornaam": "Henk"}""")

        assertThat(submittedResourceListener.events).isEmpty()
    }

    private fun startFormFlowWithUploadField(): FormFlowInstance {
        processLinkService.createProcessLink(
            FormFlowProcessLinkCreateRequestDto(
                getProcessDefinitionId(),
                "do-something",
                ActivityTypeWithEventName.USER_TASK_CREATE,
                "upload-bijlage"
            ),
            caseDefinitionId
        )
        val processInstanceId = newDocumentAndStartProcess()
        return openTasks(processInstanceId).single()
    }

    private fun completeCurrentStep(formFlowInstance: FormFlowInstance, submissionData: String) {
        runWithoutAuthorization {
            formFlowResource.completeStep(
                formFlowInstance.id.id.toString(),
                formFlowInstance.getCurrentStep().id.id.toString(),
                objectMapper.readTree(submissionData)
            )
        }
    }

    private fun getProcessDefinitionId(): String {
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey("formflow-one-task-process")
            .latestVersion()
            .singleResult()
            .id
    }

    private fun newDocumentAndStartProcess(): ProcessInstanceId {
        return runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    "formflow-one-task-process",
                    NewDocumentRequest(
                        "profile",
                        "profile",
                        "1.0.0",
                        objectMapper.readTree("{}")
                    )
                )
            )
        }.resultingProcessInstanceId().get()
    }

    private fun openTasks(processInstanceId: ProcessInstanceId): List<FormFlowInstance> {
        return runWithoutAuthorization {
            taskService.findTasks(OperatonTaskSpecificationHelper.byProcessInstanceId(processInstanceId.toString()))
                .asSequence()
                .map { processLinkActivityService.openTask(UUID.fromString(it.id)) }
                .filter { it.properties is FormFlowTaskOpenResultProperties }
                .map { (it.properties as FormFlowTaskOpenResultProperties).formFlowInstanceId }
                .map { formFlowService.getInstanceById(FormFlowInstanceId(it)) }
                .toList()
        }
    }

    @TestConfiguration
    class SubmittedResourceListenerConfiguration {
        @Bean
        fun submittedResourceListener() = SubmittedResourceListener()
    }

    class SubmittedResourceListener {
        val events: MutableList<TemporaryResourceSubmittedEvent> = mutableListOf()

        @EventListener(TemporaryResourceSubmittedEvent::class)
        fun handle(event: TemporaryResourceSubmittedEvent) {
            events.add(event)
        }
    }
}
