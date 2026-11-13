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

package com.ritense.form.service

import com.ritense.form.domain.FormProcessLink
import com.ritense.form.exception.FormDefinitionInUseException
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.repository.FormProcessLinkRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

class FormDefinitionUsageGuardTest {

    private lateinit var formDefinitionRepository: FormDefinitionRepository
    private lateinit var formProcessLinkRepository: FormProcessLinkRepository
    private lateinit var operatonProcessService: OperatonProcessService
    private lateinit var guard: FormDefinitionUsageGuard

    private val formId = UUID.randomUUID()
    private val caseDefinitionId = CaseDefinitionId.of("person", "1.0.0")

    @BeforeEach
    fun setUp() {
        formDefinitionRepository = mock()
        formProcessLinkRepository = mock()
        operatonProcessService = mock()
        guard = FormDefinitionUsageGuard(
            formDefinitionRepository,
            formProcessLinkRepository,
            operatonProcessService,
            FormProcessLinkUsageResolver(operatonProcessService),
        )
    }

    @Test
    fun `should throw with process key, name and activity when the form is in use`() {
        val link = link("my-process:1:abc", "userTask1")
        whenever(formProcessLinkRepository.findByFormDefinitionId(formId)).thenReturn(listOf(link))
        val definition = processDefinition("my-process:1:abc", "my-process", "My process")
        whenever(operatonProcessService.findProcessDefinitionById("my-process:1:abc")).thenReturn(definition)

        assertThatThrownBy { guard.lockAndAssertNotInUse(formId) }
            .isInstanceOfSatisfying(FormDefinitionInUseException::class.java) {
                assertThat(it.detail).contains("My process").contains("userTask1")
                assertThat(it.parameters["usages"] as List<*>).containsExactly(
                    mapOf(
                        "processDefinitionKey" to "my-process",
                        "processDefinitionName" to "My process",
                        "activityId" to "userTask1",
                    )
                )
            }
    }

    @Test
    fun `should pass when the form is not in use`() {
        whenever(formProcessLinkRepository.findByFormDefinitionId(formId)).thenReturn(emptyList())

        assertThatCode { guard.lockAndAssertNotInUse(formId) }.doesNotThrowAnyException()
    }

    @Test
    fun `should ignore links of the processes of the case itself`() {
        whenever(formProcessLinkRepository.findByFormDefinitionIdIn(listOf(formId)))
            .thenReturn(listOf(link("own:1:abc", "userTask1")))
        val own = processDefinition("own:1:abc", "own", "Own")
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId)).thenReturn(listOf(own))

        assertThatCode { guard.lockAndAssertNotInUseOutside(caseDefinitionId, listOf(formId)) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `should refuse when a process outside the case links to a form of the case`() {
        whenever(formProcessLinkRepository.findByFormDefinitionIdIn(listOf(formId)))
            .thenReturn(listOf(link("own:1:abc", "userTask1"), link("other:1:abc", "userTask2")))
        val own = processDefinition("own:1:abc", "own", "Own")
        whenever(operatonProcessService.getAllDefinitions(caseDefinitionId)).thenReturn(listOf(own))

        assertThatThrownBy { guard.lockAndAssertNotInUseOutside(caseDefinitionId, listOf(formId)) }
            .isInstanceOfSatisfying(FormDefinitionInUseException::class.java) {
                assertThat(it.parameters["usages"] as List<*>).hasSize(1)
                assertThat(it.detail).contains("userTask2")
            }
    }

    private fun link(processDefinitionId: String, activityId: String) = FormProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
        formDefinitionId = formId,
    )

    private fun processDefinition(id: String, key: String, name: String): OperatonProcessDefinition {
        val definition = mock<OperatonProcessDefinition>()
        whenever(definition.id).thenReturn(id)
        whenever(definition.key).thenReturn(key)
        whenever(definition.name).thenReturn(name)
        return definition
    }
}
