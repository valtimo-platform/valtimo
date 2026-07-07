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

/**
 * The plan-level fields of a `*.migration.json` file. Component sections (`dataMigration`,
 * `processMigration`, ...) are intentionally ignored here — they are dispatched to their owning
 * [com.ritense.valtimo.contract.case_.migration.MigrationComponentDeployer] as raw JSON.
 *
 * The case definition key and target version are implied by the folder the file lives in and are
 * therefore not fields.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class MigrationPlanDeploymentDto(
    val key: String,
    val title: String? = null,
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),
    val conditions: List<MigrationCondition> = emptyList(),
)
