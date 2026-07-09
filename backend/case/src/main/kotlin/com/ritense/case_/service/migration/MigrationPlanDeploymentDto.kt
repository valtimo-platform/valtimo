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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.ritense.case_.domain.migration.MigrationCondition
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.valtimo.contract.blueprint.BlueprintType

/**
 * The plan-level fields of a `*.migration.json` file. Component sections (`dataMigration`,
 * `processMigration`, ...) are intentionally ignored here — they are dispatched to their owning
 * [com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer] as raw JSON.
 *
 * The blueprint key and target version are implied by the folder the file lives in and are
 * therefore not fields.
 *
 * The optional `source*` fields declare which instances the plan migrates FROM. When omitted they
 * default to the resolved target's blueprint type / key and the target blueprint's
 * `basedOnVersionTag`.
 *
 * The optional `target*` fields declare which blueprint version the plan migrates TO. When omitted
 * they default to the blueprint version the plan is deployed under (its folder).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanDeploymentDto(
    val key: String,
    val title: String? = null,
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),
    val conditions: List<MigrationCondition> = emptyList(),
    val sourceBlueprintType: BlueprintType? = null,
    val sourceKey: String? = null,
    val sourceVersionTag: String? = null,
    val targetBlueprintType: BlueprintType? = null,
    val targetKey: String? = null,
    val targetVersionTag: String? = null,
)
