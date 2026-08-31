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

/** Read model for the migration status shown in the UI. */
data class MigrationExecutionStatusDto(
    val status: CaseMigrationStatus,
    /** Cases still to migrate: the estimate before a run, [casesTotal] minus everything touched during and after one. */
    val casesToMigrate: Int,
    /** The progress denominator: the current run's matched slice, floored at what the plan has ever migrated or failed on — otherwise a plan run over successive batches reports "6 of 3". */
    val casesTotal: Int,
    /** Cases this plan has migrated, across every run of it. */
    val casesMigrated: Int,
    val casesWithErrors: Int,
    val errors: List<MigrationExecutionError>,
    /** Cases the plan migrated without doing everything it describes. Counted apart from [casesWithErrors] because these succeeded — but a plan doing nothing must not read like one doing its job. */
    val casesWithWarnings: Int,
    val warnings: List<MigrationExecutionWarning>,
    val startedOn: LocalDateTime?,
    val finishedOn: LocalDateTime?,
) {
    companion object {
        val NOT_STARTED = MigrationExecutionStatusDto(
            status = CaseMigrationStatus.NOT_STARTED,
            casesToMigrate = 0,
            casesTotal = 0,
            casesMigrated = 0,
            casesWithErrors = 0,
            errors = emptyList(),
            casesWithWarnings = 0,
            warnings = emptyList(),
            startedOn = null,
            finishedOn = null,
        )
    }
}
