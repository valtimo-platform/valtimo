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

/**
 * The state of the latest **dry run** of a migration plan: a simulation that reports, per matching
 * case, whether it would migrate or fail — without persisting anything. Mirrors
 * [CaseDefinitionMigrationExecution] (same clustered single-runner guard: optimistic-lock version,
 * lease expiry and fencing token) but is stored in its own table so dry-run state is completely
 * separate from real run state. The per-case outcomes live in [CaseMigrationDryRunCase] rows; the
 * counts shown in the UI are derived from those rows, so this row only holds run state and timing.
 *
 * A dry run is not resumable/idempotent the way a real run is — each dry run starts fresh (prior
 * per-case rows are cleared on claim), so re-running always reflects the current plan and data.
 */
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

    /**
     * While a dry run is executing (status RUNNING) this is renewed into the future by the owning
     * node. An expired lease means the owner died mid-run, so another node may take it over.
     */
    @Column(name = "lease_expires_at")
    var leaseExpiresAt: LocalDateTime? = null,

    /**
     * Fencing token identifying the current dry run. Set to a fresh value on every claim/takeover;
     * the running node checks it before each write and stops if it no longer matches (it was fenced).
     */
    @Column(name = "run_token", length = 64)
    var runToken: String? = null,

    @Version
    @Column(name = "version")
    var version: Long? = null,
)
