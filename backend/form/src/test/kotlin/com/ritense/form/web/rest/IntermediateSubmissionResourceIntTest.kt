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

package com.ritense.form.web.rest

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.form.BaseIntegrationTest
import com.ritense.form.domain.IntermediateSubmission
import com.ritense.form.repository.IntermediateSubmissionRepository
import com.ritense.form.service.IntermediateSubmissionService
import com.ritense.form.web.rest.dto.IntermediateSaveRequest
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import java.util.Optional
import org.junit.jupiter.api.Test
import kotlin.test.assertTrue
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultHandlers
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.test.web.servlet.setup.StandaloneMockMvcBuilder

class IntermediateSubmissionResourceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var intermediateSubmissionResource: IntermediateSubmissionResource

    @Autowired
    lateinit var intermediateSubmissionService: IntermediateSubmissionService

    @Autowired
    lateinit var intermediateSubmissionRepository: IntermediateSubmissionRepository

    @Autowired
    lateinit var repositoryService: OperatonRepositoryService

    @MockitoBean
    lateinit var operatonTaskService: OperatonTaskService

    lateinit var mockMvc: MockMvc

    private var objectMapper = MapperSingleton.get()

    @AfterEach
    internal fun cleanUp() {
        intermediateSubmissionRepository.deleteAll()
    }

    @BeforeEach
    internal fun init() {
        mockMvc = MockMvcBuilders.standaloneSetup(intermediateSubmissionResource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setControllerAdvice(ExceptionTranslator(Optional.empty()))
            .alwaysDo<StandaloneMockMvcBuilder>(MockMvcResultHandlers.print())
            .build()
        val task: OperatonTask = mock()
        val execution: OperatonExecution = mock()
        whenever(task.processInstance).thenReturn(execution)
        whenever(execution.businessKey).thenReturn("a business Key")
        whenever(task.id).thenReturn("taskInstanceId")
        whenever(task.getProcessDefinitionId()).thenReturn(
            runWithoutAuthorization { repositoryService.findLatestProcessDefinition("prefill-process") }?.id
        )
        whenever(task.taskDefinitionKey).thenReturn("prefill-task")
        whenever(operatonTaskService.findTaskById(any())).thenReturn(task)

        val manageableUser: ManageableUser = mock()
        whenever(manageableUser.username).thenReturn("username")
        whenever(manageableUser.fullName).thenReturn("FullName")
        whenever(userManagementService.currentUser).thenReturn(manageableUser)
        whenever(userManagementService.findByUsername(any())).thenReturn(manageableUser)
    }

    @Test
    fun `should return 404 for intermediate submission not found`() {
        runWithoutAuthorization {
            mockMvc.perform(
                get("$BASE_URL?taskInstanceId=taskInstanceId")
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isNotFound)
        }
    }

    @Test
    @WithMockUser
    fun `should return 200 for intermediate submission found`() {
        runWithoutAuthorization {
            intermediateSubmissionService.store(
                submission = objectMapper.createObjectNode(),
                taskInstanceId = "taskInstanceId"
            )
            mockMvc.perform(
                get("$BASE_URL?taskInstanceId=taskInstanceId")
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
        }
    }

    @Test
    @WithMockUser
    fun `should return 200 for store intermediate submission`() {
        runWithoutAuthorization {
            val submission = objectMapper.createObjectNode().apply { put("key", "value") }
            val request = IntermediateSaveRequest(
                submission = submission,
                taskInstanceId = "taskInstanceId"
            )
            val requestJson = jacksonObjectMapper().writeValueAsString(request)
            mockMvc.perform(
                post(BASE_URL)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(requestJson)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission").isNotEmpty)
                .andExpect(jsonPath("$.taskInstanceId").value(request.taskInstanceId))
                .andExpect(jsonPath("$.createdBy").value("FullName"))
                .andExpect(jsonPath("$.createdOn").isNotEmpty)
                .andExpect(jsonPath("$.editedBy").isEmpty)
                .andExpect(jsonPath("$.editedOn").isEmpty)
        }
    }

    @Test
    @WithMockUser
    fun `should return 200 deleting intermediate submission`() {
        runWithoutAuthorization {
            val intermediateSubmission = intermediateSubmissionService.store(
                submission = objectMapper.createObjectNode(),
                taskInstanceId = "taskInstanceId"
            )
            mockMvc.perform(
                delete(
                    "$BASE_URL?taskInstanceId={taskInstanceId}",
                    intermediateSubmission.taskInstanceId
                ).accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
        }
    }

    @Test
    @WithMockUser
    fun `should strip preview values when storing intermediate submission`() {
        runWithoutAuthorization {
            val submission = objectMapper.readTree(
                """
                {
                  "inputDisabled": "kept",
                  "mailPreview": { "body": "<b>evil</b>" },
                  "container": { "containerProperty1": "c1", "rowPreview": "<b>evil</b>" },
                  "docGrid": [ { "gridName": "g1", "rowPreview": "<b>evil</b>" } ]
                }
                """
            )
            val requestJson = jacksonObjectMapper().writeValueAsString(
                IntermediateSaveRequest(submission = submission as com.fasterxml.jackson.databind.node.ObjectNode, taskInstanceId = "taskInstanceId")
            )
            mockMvc.perform(
                post(BASE_URL)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(requestJson)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission.inputDisabled").value("kept"))
                .andExpect(jsonPath("$.submission.mailPreview.body").doesNotExist())
                .andExpect(jsonPath("$.submission.container.containerProperty1").value("c1"))
                .andExpect(jsonPath("$.submission.container.rowPreview").doesNotExist())
                .andExpect(jsonPath("$.submission.docGrid[0].gridName").value("g1"))
                .andExpect(jsonPath("$.submission.docGrid[0].rowPreview").doesNotExist())

            mockMvc.perform(
                get("$BASE_URL?taskInstanceId=taskInstanceId")
                    .accept(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission.inputDisabled").value("kept"))
                .andExpect(jsonPath("$.submission.mailPreview.body").doesNotExist())
                .andExpect(jsonPath("$.submission.container.containerProperty1").value("c1"))
                .andExpect(jsonPath("$.submission.container.rowPreview").doesNotExist())
                .andExpect(jsonPath("$.submission.docGrid[0].gridName").value("g1"))
                .andExpect(jsonPath("$.submission.docGrid[0].rowPreview").doesNotExist())
        }
    }

    @Test
    @WithMockUser
    fun `should strip flat dotted preview keys inside grid rows when storing intermediate submission`() {
        runWithoutAuthorization {
            val submission = objectMapper.readTree(
                """
                {
                  "docGrid": [ { "gridName": "g1", "mailPreview.ontvangstbevestiging": "<img src=x onerror=alert(1)>" } ]
                }
                """
            )
            val requestJson = jacksonObjectMapper().writeValueAsString(
                IntermediateSaveRequest(submission = submission as com.fasterxml.jackson.databind.node.ObjectNode, taskInstanceId = "taskInstanceId")
            )
            mockMvc.perform(
                post(BASE_URL)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(requestJson)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission.docGrid[0].gridName").value("g1"))
                .andExpect(jsonPath("$.submission.docGrid[0]['mailPreview.ontvangstbevestiging']").doesNotExist())

            mockMvc.perform(
                get("$BASE_URL?taskInstanceId=taskInstanceId")
                    .accept(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission.docGrid[0].gridName").value("g1"))
                .andExpect(jsonPath("$.submission.docGrid[0]['mailPreview.ontvangstbevestiging']").doesNotExist())
        }
    }

    @Test
    @WithMockUser
    fun `should strip preview values from legacy intermediate submission on get`() {
        runWithoutAuthorization {
            val content = objectMapper.readTree(
                """
                {
                  "inputDisabled": "kept",
                  "mailPreview": { "body": "<b>evil</b>" },
                  "container": { "containerProperty1": "c1", "rowPreview": "<b>evil</b>" }
                }
                """
            ) as com.fasterxml.jackson.databind.node.ObjectNode
            intermediateSubmissionRepository.save(
                IntermediateSubmission.new(content = content, taskInstanceId = "taskInstanceId", createdBy = "username")
            )

            mockMvc.perform(
                get("$BASE_URL?taskInstanceId=taskInstanceId")
                    .accept(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.submission.inputDisabled").value("kept"))
                .andExpect(jsonPath("$.submission.mailPreview.body").doesNotExist())
                .andExpect(jsonPath("$.submission.container.containerProperty1").value("c1"))
                .andExpect(jsonPath("$.submission.container.rowPreview").doesNotExist())
        }
    }

    @Test
    @WithMockUser
    fun `should return 404 and store nothing for task without form link`() {
        runWithoutAuthorization {
            val task: OperatonTask = mock()
            val execution: OperatonExecution = mock()
            whenever(task.processInstance).thenReturn(execution)
            whenever(task.id).thenReturn("taskInstanceId")
            whenever(task.getProcessDefinitionId()).thenReturn(
                repositoryService.findLatestProcessDefinition("prefill-process")?.id
            )
            whenever(task.taskDefinitionKey).thenReturn("task-without-link")
            whenever(operatonTaskService.findTaskById(any())).thenReturn(task)

            val requestJson = jacksonObjectMapper().writeValueAsString(
                IntermediateSaveRequest(
                    submission = objectMapper.createObjectNode().apply { put("key", "value") },
                    taskInstanceId = "taskInstanceId"
                )
            )
            mockMvc.perform(
                post(BASE_URL)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(requestJson)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isNotFound)

            assertTrue(intermediateSubmissionRepository.findAll().isEmpty())
        }
    }

    companion object {
        const val BASE_URL = "/api/v1/form/intermediate/submission"
    }
}