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

import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.MigrationExecutionError
import java.time.LocalDateTime

/**
 * Read model for the result of a migration plan **dry run** shown in the UI: how many matching cases
 * were checked, how many would migrate, how many would fail — plus, for each failing case, the
 * reason (the full stacktrace). Reuses [CaseMigrationStatus] for the run state and
 * [MigrationExecutionError] for the per-case failures, so the UI can render dry-run failures with
 * the same table as real-run failures.
 */
data class DryRunStatusDto(
    val status: CaseMigrationStatus,
    val casesChecked: Int,
    val casesWouldMigrate: Int,
    val casesWouldFail: Int,
    val errors: List<MigrationExecutionError>,
    val startedOn: LocalDateTime?,
    val finishedOn: LocalDateTime?,
) {
    companion object {
        val NOT_STARTED = DryRunStatusDto(
            status = CaseMigrationStatus.NOT_STARTED,
            casesChecked = 0,
            casesWouldMigrate = 0,
            casesWouldFail = 0,
            errors = emptyList(),
            startedOn = null,
            finishedOn = null,
        )
    }
}
