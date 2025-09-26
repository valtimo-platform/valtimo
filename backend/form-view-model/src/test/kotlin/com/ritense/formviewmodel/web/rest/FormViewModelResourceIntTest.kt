package com.ritense.formviewmodel.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.formviewmodel.BaseIntegrationTest
import com.ritense.formviewmodel.submission.TestUserTaskSubmissionHandler
import com.ritense.formviewmodel.submission.TestUserTaskUIComponentSubmissionHandler
import com.ritense.formviewmodel.viewmodel.TestViewModel
import com.ritense.formviewmodel.web.rest.FormViewModelResourceTest.Companion.BASE_URL
import com.ritense.formviewmodel.web.rest.FormViewModelResourceTest.Companion.USER_TASK
import com.ritense.valtimo.camunda.domain.ProcessInstanceWithDefinition
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.service.CamundaProcessService
import org.camunda.bpm.engine.TaskService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class FormViewModelResourceIntTest @Autowired constructor(
    private val formViewModelResource: FormViewModelResource,
    private val objectMapper: ObjectMapper,
    private val processService: CamundaProcessService,
    private val taskService: TaskService,
    private val testUserTaskSubmissionHandler: TestUserTaskSubmissionHandler,
    private val testUserTaskUIComponentSubmissionHandler: TestUserTaskUIComponentSubmissionHandler
) : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @BeforeEach
    internal fun init() {
        mockMvc = MockMvcBuilders.standaloneSetup(formViewModelResource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .build()
    }


    @Test
    fun `should get user task view model for form`() {
        val processInstance = startNewProcess()
        val taskInstanceId = getActiveTaskInstanceId(processInstance)
        runWithoutAuthorization {
            mockMvc.perform(
                get("$BASE_URL/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
        }
    }

    @Test
    fun `should update user task view model for form`() {
        val processInstance = startNewProcess()
        val taskInstanceId = getActiveTaskInstanceId(processInstance)

        runWithoutAuthorization {
            mockMvc.perform(
                post("$BASE_URL/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(objectMapper.writeValueAsString(TestViewModel(reversedString = "abc")))
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.reversedString").value("cba"))
        }
    }

    @Test
    fun `should submit user task view model for form`() {
        val processInstance = startNewProcess()
        val taskInstanceId = getActiveTaskInstanceId(processInstance)
        runWithoutAuthorization {
            mockMvc.perform(
                post("$BASE_URL/submit/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
                    .content(
                        objectMapper.writeValueAsString(
                            TestViewModel(
                                age = 22
                            )
                        )
                    )
            ).andExpect(status().isNoContent)
        }

        verify(testUserTaskSubmissionHandler, times(1)).handle(any<TestViewModel>(), any(), eq(processInstance.processInstanceDto.businessKey))
    }


    @Test
    fun `should get user task view model for ui-component`() {
        val processInstance = startNewProcess("fvm-uicomponent-task-process")
        val taskInstanceId = getActiveTaskInstanceId(processInstance)
        runWithoutAuthorization {
            mockMvc.perform(
                get("$BASE_URL/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
        }
    }

    @Test
    fun `should update user task view model for ui-component`() {
        val processInstance = startNewProcess("fvm-uicomponent-task-process")
        val taskInstanceId = getActiveTaskInstanceId(processInstance)

        runWithoutAuthorization {
            mockMvc.perform(
                post("$BASE_URL/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .content(objectMapper.writeValueAsString(TestViewModel(reversedString = "abc")))
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
            ).andExpect(status().isOk)
                .andExpect(jsonPath("$.reversedString").value("cba"))
        }
    }

    @Test
    fun `should submit user task view model for ui-component`() {
        val processInstance = startNewProcess("fvm-uicomponent-task-process")
        val taskInstanceId = getActiveTaskInstanceId(processInstance)
        runWithoutAuthorization {
            mockMvc.perform(
                post("$BASE_URL/submit/$USER_TASK")
                    .queryParam("taskInstanceId", taskInstanceId)
                    .accept(APPLICATION_JSON_UTF8_VALUE)
                    .contentType(APPLICATION_JSON_UTF8_VALUE)
                    .content(
                        objectMapper.writeValueAsString(
                            TestViewModel(
                                age = 22
                            )
                        )
                    )
            ).andExpect(status().isNoContent)
        }

        verify(testUserTaskUIComponentSubmissionHandler, times(1)).handle(any<TestViewModel>(), any(), eq(processInstance.processInstanceDto.businessKey))
    }

    private fun startNewProcess(processDefinitionKey: String = "fvm-form-task-process"): ProcessInstanceWithDefinition = runWithoutAuthorization {
        processService.startProcess(
            processDefinitionKey,
            UUID.randomUUID().toString(),
            mapOf()
        )
    }

    private fun getActiveTaskInstanceId(instance: ProcessInstanceWithDefinition) = taskService.createTaskQuery()
        .processInstanceId(instance.processInstanceDto.id)
        .taskDefinitionKey("user-task")
        .active()
        .singleResult()?.id ?: throw NullPointerException("No task found")

}