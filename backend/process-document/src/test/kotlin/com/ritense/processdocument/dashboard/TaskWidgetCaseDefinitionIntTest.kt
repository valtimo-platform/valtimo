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

package com.ritense.processdocument.dashboard

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonDocumentContent
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.conditions.OrConditionGroup
import com.ritense.valtimo.contract.repository.ExpressionOperator
import com.ritense.valtimo.dashboard.TaskCountDataSourceProperties
import com.ritense.valtimo.dashboard.TaskWidgetDataSource
import org.assertj.core.api.Assertions.assertThat
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.task.Task
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional

@Transactional
class TaskWidgetCaseDefinitionIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var taskWidgetDataSource: TaskWidgetDataSource

    @Autowired
    lateinit var documentService: DocumentService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var taskService: TaskService

    @Test
    @WithMockUser(authorities = [AuthoritiesConstants.ADMIN])
    fun `should only count tasks belonging to the given case definition`() {
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(TASK, "loan-process-demo-3")

        val properties = TaskCountDataSourceProperties(caseDefinitionName = HOUSE)

        val result = count(properties)

        assertThat(result.value).isEqualTo(2)
        assertThat(result.total).isEqualTo(2)
    }

    @Test
    @WithMockUser(authorities = [AuthoritiesConstants.ADMIN])
    fun `should combine the case definition filter with a condition tree`() {
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(TASK, "loan-process-demo-3")

        val properties = TaskCountDataSourceProperties(
            caseDefinitionName = HOUSE,
            conditions = listOf(
                OrConditionGroup(
                    listOf(
                        Condition("task:name", ExpressionOperator.EQUAL_TO, "Akkoord op lening?"),
                        Condition("task:name", ExpressionOperator.EQUAL_TO, "Non-existent"),
                    )
                )
            )
        )

        val result = count(properties)

        assertThat(result.value).isEqualTo(2)
        assertThat(result.total).isEqualTo(2)
    }

    @Test
    @WithMockUser(authorities = [AuthoritiesConstants.ADMIN])
    fun `should return zero for a case definition without tasks`() {
        createCaseWithProcess(HOUSE, "loan-process-demo")

        val properties = TaskCountDataSourceProperties(caseDefinitionName = TASK)

        val result = count(properties)

        assertThat(result.value).isEqualTo(0)
        assertThat(result.total).isEqualTo(0)
    }

    @Test
    @WithMockUser(authorities = [AuthoritiesConstants.ADMIN])
    fun `should count across all definitions for a legacy config without caseDefinitionName`() {
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createCaseWithProcess(TASK, "loan-process-demo-3")

        val properties = objectMapper.readValue(
            """{"queryConditions":[]}""",
            TaskCountDataSourceProperties::class.java
        )
        assertThat(properties.caseDefinitionName).isNull()

        val result = count(properties)

        assertThat(result.value).isEqualTo(3)
        assertThat(result.total).isEqualTo(3)
    }

    @Test
    @WithMockUser(authorities = [AuthoritiesConstants.ADMIN])
    fun `should exclude a standalone task when caseDefinitionName is set but include it otherwise`() {
        createCaseWithProcess(HOUSE, "loan-process-demo")
        createStandaloneTask()

        val scopedResult = count(TaskCountDataSourceProperties(caseDefinitionName = HOUSE))
        assertThat(scopedResult.value).isEqualTo(1)
        assertThat(scopedResult.total).isEqualTo(1)

        val unscopedResult = count(TaskCountDataSourceProperties())
        assertThat(unscopedResult.value).isEqualTo(2)
        assertThat(unscopedResult.total).isEqualTo(2)
    }

    private fun count(properties: TaskCountDataSourceProperties) =
        runWithoutAuthorization { taskWidgetDataSource.getTaskCount(properties) }

    private fun createCaseWithProcess(definitionName: String, processDefinitionKey: String) {
        val content = JsonDocumentContent("{\"street\": \"Funenpark\"}")
        val document = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(definitionName, definitionName, "1.0.0", content.asJson())
            )
        }
        runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.startProcessForDocument(
                StartProcessForDocumentRequest(
                    document.resultingDocument().orElseThrow().id(),
                    processDefinitionKey,
                    mapOf()
                )
            )
        }
    }

    private fun createStandaloneTask() {
        val task: Task = taskService.newTask()
        task.name = "Standalone"
        taskService.saveTask(task)
    }

    companion object {
        private const val HOUSE = "house"
        private const val TASK = "task"
    }
}
