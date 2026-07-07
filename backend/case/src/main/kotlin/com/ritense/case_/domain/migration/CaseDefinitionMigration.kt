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

import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Type

/**
 * The plan-level skeleton of a migration plan: its title, triggers and gating conditions.
 *
 * The actual migration actions live in separate components owned by their respective modules
 * (e.g. `dataMigration`, `processMigration`) and are deployed through
 * [com.ritense.valtimo.contract.case_.migration.MigrationComponentDeployer].
 */
@Entity
@Table(name = "case_definition_migration")
data class CaseDefinitionMigration(

    @EmbeddedId
    val id: CaseDefinitionMigrationId,

    @Column(name = "title")
    val title: String? = null,

    @Type(JsonType::class)
    @Column(name = "migration_triggers", nullable = false)
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),

    @Type(JsonType::class)
    @Column(name = "conditions", nullable = false)
    val conditions: List<MigrationCondition> = emptyList(),

    /**
     * Cached, approximate count of cases matching this plan's [conditions], refreshed by the hourly
     * trigger sweep. Lets the UI show "cases to migrate" before a run starts (computing it live is
     * expensive). Null until first computed; once a run starts the execution's live count is
     * authoritative instead. Reset on redeploy and recomputed on the next sweep.
     */
    @Column(name = "estimated_cases_to_migrate")
    var estimatedCasesToMigrate: Int? = null,
)
