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

/**
 * Validates a `processMigration` activity mapping against the process engine's own migration rules,
 * so the whole stack (suggester, API and UI) relies on the engine as the single source of truth for
 * which `sourceActivityId -> targetActivityId` pairs are compatible instead of reimplementing that
 * matrix in three places.
 *
 * Implemented by the process module (which owns the engine); consumed by the migration suggestion
 * service and the management API.
 */
interface ActivityMappingValidator {

    /**
     * The subset of [activityMapping] (`sourceActivityId -> targetActivityId`) that the engine rejects
     * as incompatible for migrating [sourceProcessDefinitionId] to [targetProcessDefinitionId], keyed
     * by source activity id with the engine's failure messages. Empty when every mapping is valid.
     */
    fun findInvalidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, List<String>>
}
