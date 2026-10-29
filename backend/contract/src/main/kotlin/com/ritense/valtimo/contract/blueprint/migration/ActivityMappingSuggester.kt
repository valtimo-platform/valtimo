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

package com.ritense.valtimo.contract.blueprint.migration

/** Suggests a best-effort activity mapping between two process definitions, so the heuristic lives in one place and serves both the whole-plan and the on-the-fly suggestion. */
interface ActivityMappingSuggester {

    /** A best-effort `sourceActivityId -> targetActivityId` mapping, or empty when nothing can be suggested. */
    fun suggestActivityMapping(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
    ): Map<String, String>
}
