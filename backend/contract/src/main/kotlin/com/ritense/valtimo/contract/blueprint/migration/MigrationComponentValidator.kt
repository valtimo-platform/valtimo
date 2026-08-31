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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.contract.BlueprintId

/** Lets the module owning a plan component validate it before the plan is saved, so the API rejects an invalid plan up front. Mirrors [MigrationComponentDeployer]. */
interface MigrationComponentValidator {

    /** The top-level migration plan property this validator is responsible for (its component key). */
    fun componentKey(): String

    /** Descriptions of everything in [component] that would make migrating [source] to [target] invalid; empty when valid. Best-effort — an unresolvable component leaves the run as the final guard. */
    fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String>
}
