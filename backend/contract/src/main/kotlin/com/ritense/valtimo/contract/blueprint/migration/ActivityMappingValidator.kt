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

/** Validates an activity mapping against the engine's own migration rules, so suggester, API and UI all rely on the engine rather than reimplementing its compatibility matrix. */
interface ActivityMappingValidator {

    /** The subset of [activityMapping] the engine rejects, keyed by source activity id with its failure messages. Empty when every mapping is valid. */
    fun findInvalidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, List<String>>
}
