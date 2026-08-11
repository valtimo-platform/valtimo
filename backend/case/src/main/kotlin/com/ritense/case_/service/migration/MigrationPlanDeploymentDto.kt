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
import com.ritense.case_.domain.migration.MigrationConditionNode
import com.ritense.case_.domain.migration.MigrationTriggers

/**
 * The plan-level fields of a `*.migration.json` file. Component sections (`dataMigration`,
 * `processMigration`, ...) are intentionally ignored here — they are dispatched to their owning
 * [com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer] as raw JSON.
 *
 * The blueprint kind, key and version a plan migrates instances **to** are implied by the folder the
 * file lives in. The version it migrates them **from** is [source], and is required: it is the one
 * thing about a plan that cannot be derived from where it sits.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanDeploymentDto(
    val key: String,
    val source: MigrationPlanSourceDto? = null,
    val title: String? = null,
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),
    val conditions: List<MigrationConditionNode> = emptyList(),
)

/**
 * The blueprint version a plan migrates instances FROM. Both fields are required — a source is never
 * inferred, because inferring it is exactly what stops a plan spanning several versions or changing
 * key.
 *
 * There is no blueprint *type*: a plan migrates instances of the same kind of blueprint it is
 * deployed under (a case plan migrates cases, a building block plan migrates building blocks).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanSourceDto(
    val key: String? = null,
    val versionTag: String? = null,
)
