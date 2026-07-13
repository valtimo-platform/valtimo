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

package com.ritense.case_.domain.migration

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Lob
import jakarta.persistence.Table

/**
 * The outcome of migrating a single case under a migration plan. One row per (plan, case), so
 * progress is tracked with O(1) indexed writes/reads instead of a growing collection on the
 * execution row. Re-runs skip cases that are already [CaseMigrationCaseStatus.MIGRATED]; a
 * successful retry flips a previously FAILED row to MIGRATED.
 */
@Entity
@Table(name = "blueprint_migration_case")
data class CaseMigrationCase(

    @EmbeddedId
    val id: CaseMigrationCaseId,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    val status: CaseMigrationCaseStatus,

    @Lob
    @Column(name = "error_message")
    val errorMessage: String? = null,
)
