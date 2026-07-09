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

import com.ritense.valtimo.contract.BlueprintId
import java.util.UUID

/**
 * Bridge that lets any module *execute* its component of a migration plan for a single instance.
 *
 * The counterpart of [MigrationComponentDeployer] (which stores a component): once a plan is
 * triggered and an instance's conditions hold, the `case` module's migration orchestrator calls
 * every registered executor for that instance **inside one transaction**. Because Operaton shares
 * the application's transaction manager and datasource, the `case` module's `dataMigration`
 * (JPA/document) and the `processMigration` (Operaton) either commit together or roll back
 * together — an instance that fails to migrate stays entirely on the old version.
 *
 * Implementations must run in the caller's transaction (propagation REQUIRED — never open a new
 * transaction) and must let exceptions propagate so the whole instance rolls back. An executor
 * that does not apply to the plan's [BlueprintMigrationId.blueprintType] must no-op.
 */
interface MigrationComponentExecutor {

    /**
     * The migration plan component this executor runs, e.g. `"dataMigration"` or
     * `"processMigration"`. Matches the corresponding [MigrationComponentDeployer.componentKey].
     */
    fun componentKey(): String

    /**
     * Execute this component's migration for a single [caseId] (the document/case instance id),
     * using the configuration previously deployed for [migrationId]. [target] is the resolved
     * blueprint version the instance is migrated TO (the plan's `target*` override, or the plan's
     * own blueprint version by default). Does nothing when this plan has no data for this component,
     * or when this executor does not apply to the target's blueprint type.
     */
    fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID)
}
