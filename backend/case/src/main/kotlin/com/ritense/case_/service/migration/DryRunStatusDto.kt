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
import com.ritense.case_.domain.migration.MigrationExecutionWarning
import java.time.LocalDateTime

/** Read model for a plan's dry run. Reuses [CaseMigrationStatus] and [MigrationExecutionError], so the UI renders dry-run failures with the same table as real ones. */
data class DryRunStatusDto(
    val status: CaseMigrationStatus,
    val casesChecked: Int,
    val casesWouldMigrate: Int,
    val casesWouldFail: Int,
    val errors: List<MigrationExecutionError>,
    /** Cases that would migrate, but for which a component would skip its work — the cheapest place to discover a plan that would create nothing. */
    val casesWithWarnings: Int,
    val warnings: List<MigrationExecutionWarning>,
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
            casesWithWarnings = 0,
            warnings = emptyList(),
            startedOn = null,
            finishedOn = null,
        )
    }
}
