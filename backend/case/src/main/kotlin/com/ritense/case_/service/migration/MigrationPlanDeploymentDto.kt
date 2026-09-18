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

/** The plan-level fields of a `*.migration.json`. Component sections are dispatched to their owning deployer as raw JSON. The target is implied by the folder; the required [source] is not. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanDeploymentDto(
    val key: String,
    val source: MigrationPlanSourceDto? = null,
    val title: String? = null,
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),
    val conditions: List<MigrationConditionNode> = emptyList(),
)

/** The blueprint version a plan migrates instances FROM. Both fields required — inferring a source is what stops a plan spanning versions or changing key. No type: it matches the plan's own. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanSourceDto(
    val key: String? = null,
    val versionTag: String? = null,
)
