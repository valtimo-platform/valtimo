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
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

/** The outcome of migrating one case: one row per (plan, case), so progress is O(1) indexed writes rather than a growing collection. Re-runs skip MIGRATED rows; a successful retry flips a FAILED one. */
@Entity
@Table(name = "blueprint_migration_case")
data class CaseMigrationCase(

    @EmbeddedId
    val id: CaseMigrationCaseId,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    val status: CaseMigrationCaseStatus,

    // LONGVARCHAR, not @Lob — see the note on CaseMigrationDryRunCase.errorMessage.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_message")
    val errorMessage: String? = null,

    /** What the components decided not to do, newline-separated, or null. A migrated case with warnings has succeeded — "47 migrated" alone would misrepresent a run that created nothing. */
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "warnings")
    val warnings: String? = null,
)
