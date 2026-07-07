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

package com.ritense.externalplugin.processlink

import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.service.ExternalPluginFrontendBundleResolver
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonTask
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.LocalDateTime
import java.util.UUID

class ExternalPluginTaskFormProcessLinkActivityHandlerTest {

    private val bundleResolver = mock<ExternalPluginFrontendBundleResolver>()
    private val handler = ExternalPluginTaskFormProcessLinkActivityHandler(bundleResolver)

    @Test
    fun `supports only the task-form process link`() {
        assertThat(handler.supports(taskFormLink())).isTrue()
        assertThat(
            handler.supports(
                ExternalPluginProcessLink(
                    id = UUID.randomUUID(),
                    processDefinitionId = "pd-1",
                    activityId = "activity-1",
                    activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
                    externalPluginConfigurationId = UUID.randomUUID(),
                    actionKey = "some-action",
                    pluginVersion = "0.1.0",
                )
            )
        ).isFalse()
    }

    @Test
    fun `openTask returns the task-form render descriptor with task context`() {
        val configId = UUID.randomUUID()
        val processLink = taskFormLink(configurationId = configId, bundleKey = "review")
        whenever(bundleResolver.resolveBundleUrl(configId, "task-form", "review"))
            .thenReturn("http://host:8090/plugins/case-summary/0.1.0/bundles/task-form.html")

        val due = LocalDateTime.now()
        val processInstance = mock<OperatonExecution>()
        whenever(processInstance.id).thenReturn("process-instance-1")
        whenever(processInstance.businessKey).thenReturn("document-1")
        val task = mock<OperatonTask>()
        whenever(task.id).thenReturn("task-1")
        whenever(task.assignee).thenReturn("john")
        whenever(task.dueDate).thenReturn(due)
        whenever(task.processInstance).thenReturn(processInstance)

        val result = handler.openTask(task, processLink)

        assertThat(result.processLinkId).isEqualTo(processLink.id)
        assertThat(result.type).isEqualTo("external-plugin-task-form")
        assertThat(result.assignee).isEqualTo("john")
        assertThat(result.due).isEqualTo(due)
        assertThat(result.properties.bundleUrl)
            .isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/task-form.html")
        assertThat(result.properties.configurationId).isEqualTo(configId)
        assertThat(result.properties.bundleKey).isEqualTo("review")
        assertThat(result.properties.context.taskId).isEqualTo("task-1")
        assertThat(result.properties.context.processInstanceId).isEqualTo("process-instance-1")
        assertThat(result.properties.context.documentId).isEqualTo("document-1")
        assertThat(result.properties.context.pluginConfigurationId).isEqualTo(configId.toString())
    }

    @Test
    fun `getStartEventObject returns the descriptor without a task id`() {
        val configId = UUID.randomUUID()
        val documentId = UUID.randomUUID()
        val processLink = taskFormLink(configurationId = configId, bundleKey = null)
        whenever(bundleResolver.resolveBundleUrl(configId, "task-form", null))
            .thenReturn("http://host:8090/plugins/case-summary/0.1.0/bundles/task-form.html")

        val result = handler.getStartEventObject("pd-1", documentId, "some-case", processLink)

        assertThat(result.type).isEqualTo("external-plugin-task-form")
        assertThat(result.assignee).isNull()
        assertThat(result.properties.context.taskId).isNull()
        assertThat(result.properties.context.documentId).isEqualTo(documentId.toString())
    }

    private fun taskFormLink(
        configurationId: UUID = UUID.randomUUID(),
        bundleKey: String? = "review",
    ) = ExternalPluginTaskFormProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "pd-1",
        activityId = "activity-1",
        activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
        externalPluginConfigurationId = configurationId,
        bundleKey = bundleKey,
        pluginVersion = "0.1.0",
    )
}
