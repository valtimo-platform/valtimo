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

/**
 * The simulated outcome of migrating a single case under a migration plan's **dry run**. One row per
 * (plan, case), keyed by the same [CaseMigrationCaseId] as a real run — but in its own table, so
 * dry-run outcomes never make a real run skip a case. On a [DryRunCaseStatus.WOULD_FAIL] the full
 * stacktrace of the failure is stored so operators can review why the case would fail.
 */
@Entity
@Table(name = "blueprint_migration_dry_run_case")
data class CaseMigrationDryRunCase(

    @EmbeddedId
    val id: CaseMigrationCaseId,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    val status: DryRunCaseStatus,

    // LONGVARCHAR, not @Lob: on PostgreSQL a @Lob String is bound as a JDBC CLOB, which the driver
    // implements as a *large object* — it writes the text into pg_largeobject and stores only the OID
    // in the column, so `select error_message` returns a number instead of the trace, and deleting the
    // row orphans the object. LONGVARCHAR keeps the same `text` / `LONGTEXT` column but binds it as
    // ordinary character data, which is what makes a failure readable in SQL.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_message")
    val errorMessage: String? = null,
)
