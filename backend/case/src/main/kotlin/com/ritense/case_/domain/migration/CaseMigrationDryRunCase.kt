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

/** The simulated outcome of migrating one case, keyed like a real run but in its own table — so a dry run never makes a real run skip a case. */
@Entity
@Table(name = "blueprint_migration_dry_run_case")
data class CaseMigrationDryRunCase(

    @EmbeddedId
    val id: CaseMigrationCaseId,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    val status: DryRunCaseStatus,

    // LONGVARCHAR, not @Lob: on PostgreSQL a @Lob String binds as a CLOB, which stores a pg_largeobject OID in the column instead of the text.
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "error_message")
    val errorMessage: String? = null,

    /** What the components would decide not to do, newline-separated, or null. Collected in memory, so a dry run reports them despite always rolling back. */
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "warnings")
    val warnings: String? = null,
)
