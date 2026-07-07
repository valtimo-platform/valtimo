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

package com.ritense.case_.repository

import com.ritense.case_.domain.migration.CaseMigrationCase
import com.ritense.case_.domain.migration.CaseMigrationCaseId
import com.ritense.case_.domain.migration.CaseMigrationCaseStatus
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import org.springframework.data.jpa.repository.JpaRepository

interface CaseMigrationCaseRepository : JpaRepository<CaseMigrationCase, CaseMigrationCaseId> {

    fun existsByIdAndStatus(id: CaseMigrationCaseId, status: CaseMigrationCaseStatus): Boolean

    fun countByIdMigrationIdAndStatus(migrationId: CaseDefinitionMigrationId, status: CaseMigrationCaseStatus): Long

    fun findByIdMigrationIdAndStatus(
        migrationId: CaseDefinitionMigrationId,
        status: CaseMigrationCaseStatus,
    ): List<CaseMigrationCase>

    fun deleteByIdMigrationId(migrationId: CaseDefinitionMigrationId)
}
