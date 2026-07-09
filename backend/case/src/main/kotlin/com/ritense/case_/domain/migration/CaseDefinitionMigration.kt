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

import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.repository.SemverConverter
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Table
import org.hibernate.annotations.Type
import org.semver4j.Semver

/**
 * The plan-level skeleton of a migration plan: its title, triggers and gating conditions.
 *
 * The actual migration actions live in separate components owned by their respective modules
 * (e.g. `dataMigration`, `processMigration`) and are deployed through
 * [com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer].
 */
@Entity
@Table(name = "blueprint_migration")
data class CaseDefinitionMigration(

    @EmbeddedId
    val id: BlueprintMigrationId,

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

    /**
     * Optional source this plan migrates FROM. When null they default (at runtime) to the resolved
     * target's blueprint type / key, and to the target blueprint's `basedOnVersionTag` for the
     * version.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "source_blueprint_type")
    val sourceBlueprintType: BlueprintType? = null,

    @Column(name = "source_key")
    val sourceKey: String? = null,

    @Convert(converter = SemverConverter::class)
    @Column(name = "source_version_tag")
    val sourceVersionTag: Semver? = null,

    /**
     * Optional target this plan migrates TO. When null they default (at runtime) to the plan's own
     * id ([id]'s blueprint type / key / version) — i.e. the blueprint version the plan is deployed
     * under.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "target_blueprint_type")
    val targetBlueprintType: BlueprintType? = null,

    @Column(name = "target_key")
    val targetKey: String? = null,

    @Convert(converter = SemverConverter::class)
    @Column(name = "target_version_tag")
    val targetVersionTag: Semver? = null,
)
