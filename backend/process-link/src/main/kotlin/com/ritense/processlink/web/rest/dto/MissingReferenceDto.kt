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
 * Something an imported process refers to that is not present on this environment.
 *
 * Only statically determinable references are reported: call activities with a literal called
 * element, business rule tasks with a literal decision reference, and form / form flow process
 * links. Expression based references cannot be resolved up front.
 */
data class MissingReferenceDto(
    val type: MissingReferenceType,
    val reference: String,
    val activityId: String? = null,
    val processDefinitionKey: String? = null,
) {
    /**
     * Whether importing would fail on this missing reference. Form and form flow process links
     * cannot be created without their definition, which fails the entire import.
     */
    val blocksImport: Boolean get() = type.blocksImport
}

enum class MissingReferenceType(val blocksImport: Boolean) {
    SUB_PROCESS(false),
    DECISION_DEFINITION(false),
    FORM(true),
    FORM_FLOW(true),

    /**
     * The process already exists on this environment as a system process that may not be updated.
     */
    READ_ONLY_SYSTEM_PROCESS(true),
}
