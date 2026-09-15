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

import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.LocalDateTime

/** The state of a plan's latest dry run. Mirrors [CaseDefinitionMigrationExecution]'s single-runner guard but in its own table, and always starts fresh rather than resuming. */
@Entity
@Table(name = "blueprint_migration_dry_run")
data class CaseMigrationDryRun(

    @EmbeddedId
    val id: BlueprintMigrationId,

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    var status: CaseMigrationStatus = CaseMigrationStatus.NOT_STARTED,

    @Column(name = "started_on")
    var startedOn: LocalDateTime? = null,

    @Column(name = "finished_on")
    var finishedOn: LocalDateTime? = null,

    /** Renewed into the future by the owning node while RUNNING; an expired lease means it may be taken over. */
    @Column(name = "lease_expires_at")
    var leaseExpiresAt: LocalDateTime? = null,

    /** Fencing token for the current dry run, refreshed on every claim; the running node stops when it no longer matches. */
    @Column(name = "run_token", length = 64)
    var runToken: String? = null,

    /** Who started this dry run. Recorded for the same reason as on a real run's execution row. */
    @Column(name = "run_actor", length = 255)
    var runActor: String? = null,

    @Version
    @Column(name = "version")
    var version: Long? = null,
)
