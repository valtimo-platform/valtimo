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


package com.ritense.buildingblock.web.rest.dto

/** Why a chain cannot be updated; the frontend translates by code, [template] is the English fallback. */
enum class BuildingBlockReferenceUpdateReasonCode(private val template: String) {
    CYCLE("The chain contains a cycle of building blocks referencing each other."),
    SELF_REFERENCE("Building block {container} would call building block {targetKey}, which is itself."),
    TARGET_USES_CONTAINER("Building block {target} uses {container}, so pointing that at {target} creates a cycle."),
    ALREADY_LINKS_TARGET("{container} already links building block {targetKey}."),
    DRAFTS_NOT_ALLOWED("This environment does not allow drafts, so no draft can be created or changed."),
    DRAFT_MISSING_REFERENCE(
        "Open draft {draft} no longer contains the reference {location} to building block {buildingBlockKey}; change that draft yourself."
    ),
    CONFLICT_SECOND_DRAFT(
        "Conflicts with another selected chain: both would create a new draft of {key}; update one version at a time."
    ),
    CONFLICT_CHILD("Conflicts with another selected chain: {location} in {container} would point to both {first} and {second}."),
    CONFLICT_INPUT("Conflicts with another selected chain: input '{input}' of {location} in {container} gets two different sources."),
    CONFLICT_PLUGIN(
        "Conflicts with another selected chain: plugin '{plugin}' of {location} in {container} gets two different configurations."
    ),
    ;

    fun format(parameters: Map<String, String>): String =
        parameters.entries.fold(template) { message, (name, value) -> message.replace("{$name}", value) }
}
