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

package com.ritense.valtimo.contract.case_.migration

import com.fasterxml.jackson.databind.JsonNode

/**
 * Bridge that lets any module own a single section ("component") of a migration plan.
 *
 * A migration plan (`*.migration.json`) is a package of instructions to migrate cases from one
 * case definition version to the next. The plan file itself is imported, exported and
 * auto-deployed by the `case` module, but each component is owned by a different, potentially
 * unlinked module:
 *
 * - `case` module handles the `dataMigration` component
 * - `core` module handles the `processMigration` component
 * - more components may be added in the future
 *
 * Each module contributes an implementation as a Spring bean. The `case` module collects all
 * implementations and dispatches the matching JSON section to each of them during
 * (auto-)deploy/import and reconstructs the file during export.
 */
interface MigrationComponentDeployer {

    /**
     * The top-level JSON property in the migration plan file this deployer is responsible for,
     * e.g. `"dataMigration"` or `"processMigration"`.
     */
    fun componentKey(): String

    /**
     * Persist [component] (the raw JSON value found under [componentKey]) for the given
     * migration plan. Called during (auto-)deploy and import.
     */
    fun deploy(migrationId: CaseDefinitionMigrationId, component: JsonNode)

    /**
     * Remove any previously deployed data for this migration plan. Called before a re-deploy so
     * deploys are idempotent.
     */
    fun undeploy(migrationId: CaseDefinitionMigrationId)

    /**
     * Return the component to serialize back under [componentKey] when exporting the migration
     * plan file, or `null` when this plan has no data for this component.
     */
    fun getComponentToExport(migrationId: CaseDefinitionMigrationId): Any?
}
