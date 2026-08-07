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

package com.ritense.case_.service.migration

import com.fasterxml.jackson.annotation.JsonInclude
import com.ritense.case_.domain.migration.MigrationConditionNode
import com.ritense.case_.domain.migration.MigrationTriggers

/**
 * A migration plan and its current run status, for the migration admin UI. Combines the plan
 * configuration (triggers, conditions, which components it carries) with its live execution status.
 *
 * [triggers], [conditions] and [dryRun] are **case-plan only** and are omitted for a building block
 * plan, which has none of them: it runs when a case migration moves its building block onto this
 * version, is covered by that case's dry run, and applies to exactly the instances the case migration
 * brings with it.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class MigrationPlanManagementDto(
    val migrationKey: String,
    val title: String?,
    /** Resolved blueprint version the plan migrates FROM, formatted as `<key>:<versionTag>`. */
    val source: String,
    /** Resolved blueprint version the plan migrates TO, formatted as `<key>:<versionTag>`. */
    val target: String,
    val components: List<String>,
    val status: MigrationExecutionStatusDto,
    val triggers: MigrationTriggers? = null,
    val conditions: List<MigrationConditionNode>? = null,
    /** The result of the plan's latest dry run (a simulation that migrates nothing), if it has run. */
    val dryRun: DryRunStatusDto? = null,
)
