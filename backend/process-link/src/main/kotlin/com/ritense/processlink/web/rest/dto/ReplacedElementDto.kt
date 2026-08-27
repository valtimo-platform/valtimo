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

package com.ritense.processlink.web.rest.dto

/**
 * An element bundled in the import that already exists on this environment and will be (re)deployed,
 * replacing the existing one. Because such an element can be shared with other processes, the user
 * is shown these before importing so the replacement is a conscious choice.
 */
data class ReplacedElementDto(
    val type: ReplacedElementType,
    val key: String,
)

enum class ReplacedElementType {
    PROCESS_DEFINITION,
    DECISION_DEFINITION,
    FORM,
}
