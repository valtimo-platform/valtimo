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

/** Lets any module own one section of a migration plan. The `case` module imports, exports and auto-deploys the file and dispatches each section to the deployer that claims it. */
interface MigrationComponentDeployer {

    /** The top-level JSON property this deployer owns, e.g. `"dataMigration"`. */
    fun componentKey(): String

    /** Persist [component] (the raw JSON under [componentKey]) for the plan. */
    fun deploy(migrationId: BlueprintMigrationId, component: JsonNode)

    /** Remove previously deployed data for the plan, so re-deploys are idempotent. */
    fun undeploy(migrationId: BlueprintMigrationId)

    /** The component to serialize back under [componentKey] on export, or null when the plan has none. */
    fun getComponentToExport(migrationId: BlueprintMigrationId): Any?
}
