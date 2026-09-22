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

package com.ritense.externalplugin.processlink.web.dto

/**
 * Result of an external-plugin task-form submission, mirroring the shape other process-link
 * submission types return (e.g. `URLSubmissionResult`).
 *
 * - [errors] carries non-field-specific problems (dispatch failures, a plugin's rejection message).
 * - [fieldErrors] maps a submitted field to a validation message produced by a Level 1 `submit`
 *   hook, so the plugin iframe can render them inline.
 * - [documentId] is the resulting case document id on success.
 *
 * A submission is considered failed (HTTP 400) when either [errors] or [fieldErrors] is non-empty.
 */
data class ExternalPluginTaskFormSubmissionResult(
    val errors: List<String> = emptyList(),
    val fieldErrors: Map<String, String> = emptyMap(),
    val documentId: String? = null,
)
