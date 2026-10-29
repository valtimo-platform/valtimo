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

import java.util.UUID

/**
 * The `properties` payload of the `external-plugin-task-form` activity result returned to the
 * frontend when a user opens a task backed by an external plugin task-form. It carries everything the
 * frontend needs to render the plugin's iframe: the resolved [bundleUrl], the [configurationId] (to
 * mint the downscoped user token and derive the plugin `/data` URL), the optional [bundleKey], and
 * the [context] the iframe passes back to the plugin (notably the [ExternalPluginTaskFormContext.taskId]
 * the plugin completes).
 */
data class ExternalPluginTaskFormResultProperties(
    val bundleUrl: String?,
    val configurationId: UUID,
    val bundleKey: String?,
    val context: ExternalPluginTaskFormContext,
)

/**
 * Opaque per-task context handed to the plugin iframe (and forwarded to the plugin's `handle_request`
 * submit handler). `taskId` is authoritative — the plugin completes exactly this task, never one the
 * browser names in a request body.
 */
data class ExternalPluginTaskFormContext(
    val taskId: String?,
    val processInstanceId: String?,
    val documentId: String?,
    val pluginConfigurationId: String,
)
