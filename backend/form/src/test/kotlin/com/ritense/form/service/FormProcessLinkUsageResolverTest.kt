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
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.UUID

class FormProcessLinkUsageResolverTest {

    private lateinit var operatonProcessService: OperatonProcessService
    private lateinit var resolver: FormProcessLinkUsageResolver

    @BeforeEach
    fun setUp() {
        operatonProcessService = mock()
        resolver = FormProcessLinkUsageResolver(operatonProcessService)
    }

    @Test
    fun `should resolve the process key, name and activity`() {
        val definition = mock<OperatonProcessDefinition>()
        whenever(definition.key).thenReturn("my-process")
        whenever(definition.name).thenReturn("My process")
        whenever(operatonProcessService.findProcessDefinitionById("my-process:1:abc")).thenReturn(definition)

        val usage = resolver.resolve(link("my-process:1:abc", "userTask1"))

        assertThat(usage.processDefinitionKey).isEqualTo("my-process")
        assertThat(usage.processDefinitionName).isEqualTo("My process")
        assertThat(usage.activityId).isEqualTo("userTask1")
    }

    @Test
    fun `should fall back to the process definition id when the process is not found`() {
        val usages = resolver.resolve(listOf(link("gone:1:abc", "userTask1")))

        assertThat(usages).hasSize(1)
        assertThat(usages.single().processDefinitionKey).isEqualTo("gone:1:abc")
        assertThat(usages.single().processDefinitionName).isNull()
    }

    private fun link(processDefinitionId: String, activityId: String) = FormProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
        formDefinitionId = UUID.randomUUID(),
    )
}
