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

/** Read model for the migration status shown in the UI. */
data class MigrationExecutionStatusDto(
    val status: CaseMigrationStatus,
    val casesToMigrate: Int,
    val casesMigrated: Int,
    val casesWithErrors: Int,
    val errors: List<MigrationExecutionError>,
    val startedOn: LocalDateTime?,
    val finishedOn: LocalDateTime?,
) {
    companion object {
        val NOT_STARTED = MigrationExecutionStatusDto(
            status = CaseMigrationStatus.NOT_STARTED,
            casesToMigrate = 0,
            casesMigrated = 0,
            casesWithErrors = 0,
            errors = emptyList(),
            startedOn = null,
            finishedOn = null,
        )
    }
}
