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

import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.service.ExternalPluginFrontendBundleResolver
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.service.ProcessLinkActivityHandler
import com.ritense.processlink.web.rest.dto.ProcessLinkActivityResult
import com.ritense.valtimo.operaton.domain.OperatonTask
import java.util.UUID

/**
 * Handles opening a user task linked to an external plugin `task-form` bundle. It resolves the
 * bundle URL and returns an `external-plugin-task-form` [ProcessLinkActivityResult] carrying the
 * iframe render instructions; the frontend embeds the plugin iframe and the plugin completes the task
 * itself under the downscoped user token. There is no server-side action to invoke — this is purely a
 * render descriptor, mirroring the URL/UI-component handlers rather than the service-task listener.
 */
class ExternalPluginTaskFormProcessLinkActivityHandler(
    private val bundleResolver: ExternalPluginFrontendBundleResolver,
) : ProcessLinkActivityHandler<ExternalPluginTaskFormResultProperties> {

    override fun supports(processLink: ProcessLink): Boolean {
        return processLink is ExternalPluginTaskFormProcessLink
    }

    override fun openTask(
        task: OperatonTask,
        processLink: ProcessLink,
    ): ProcessLinkActivityResult<ExternalPluginTaskFormResultProperties> {
        processLink as ExternalPluginTaskFormProcessLink
        return ProcessLinkActivityResult(
            processLink.id,
            ACTIVITY_RESULT_TYPE,
            task.assignee,
            task.dueDate,
            resultProperties(
                processLink,
                taskId = task.id,
                processInstanceId = task.processInstance?.id,
                documentId = task.processInstance?.businessKey,
            ),
        )
    }

    override fun getStartEventObject(
        processDefinitionId: String,
        documentId: UUID?,
        documentDefinitionName: String?,
        processLink: ProcessLink,
    ): ProcessLinkActivityResult<ExternalPluginTaskFormResultProperties> {
        processLink as ExternalPluginTaskFormProcessLink
        return ProcessLinkActivityResult(
            processLink.id,
            ACTIVITY_RESULT_TYPE,
            null,
            null,
            resultProperties(
                processLink,
                taskId = null,
                processInstanceId = null,
                documentId = documentId?.toString(),
            ),
        )
    }

    private fun resultProperties(
        processLink: ExternalPluginTaskFormProcessLink,
        taskId: String?,
        processInstanceId: String?,
        documentId: String?,
    ): ExternalPluginTaskFormResultProperties {
        val bundleUrl = bundleResolver.resolveBundleUrl(
            processLink.externalPluginConfigurationId,
            TASK_FORM_BUNDLE_TYPE,
            processLink.bundleKey,
        )
        return ExternalPluginTaskFormResultProperties(
            bundleUrl = bundleUrl,
            configurationId = processLink.externalPluginConfigurationId,
            bundleKey = processLink.bundleKey,
            context = ExternalPluginTaskFormContext(
                taskId = taskId,
                processInstanceId = processInstanceId,
                documentId = documentId,
                pluginConfigurationId = processLink.externalPluginConfigurationId.toString(),
            ),
        )
    }

    companion object {
        const val ACTIVITY_RESULT_TYPE = "external-plugin-task-form"
        private const val TASK_FORM_BUNDLE_TYPE = "task-form"
    }
}
