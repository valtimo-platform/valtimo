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

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.repository.SemverConverter
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Type
import org.semver4j.Semver

/**
 * The plan-level skeleton of a migration plan: the blueprint version it migrates instances FROM, its
 * title, triggers and gating conditions.
 *
 * The actual migration actions live in separate components owned by their respective modules
 * (e.g. `dataMigration`, `processMigration`) and are deployed through
 * [com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer].
 *
 * [migrationTriggers] and [conditions] apply to **case** plans only, and a building block plan is
 * refused at deploy time if it declares either. A building block does not migrate on its own schedule
 * and does not select its own instances: it migrates because a case migration moved it onto this
 * version, and it applies to exactly the instances that migration brought with it. See
 * `BuildingBlockVersionAlignmentExecutor`.
 */
@Entity
@Table(name = "blueprint_migration")
data class CaseDefinitionMigration(

    @EmbeddedId
    val id: BlueprintMigrationId,

    /**
     * The key of the blueprint version this plan migrates instances FROM. Usually the same key as
     * [id], but not necessarily: a plan may move instances onto a blueprint with a different key
     * altogether (a case renamed, a building block replaced by its successor).
     */
    @Column(name = "source_blueprint_key", nullable = false)
    val sourceKey: String,

    /**
     * The version of the blueprint this plan migrates instances FROM. Any earlier version, not only
     * the target's immediate predecessor — a plan declaring a source several versions back moves its
     * instances the whole way in one step.
     */
    @Convert(converter = SemverConverter::class)
    @Column(name = "source_blueprint_version_tag", nullable = false)
    val sourceVersionTag: Semver,

    @Column(name = "title")
    val title: String? = null,

    @Type(JsonType::class)
    @Column(name = "migration_triggers", nullable = false)
    val migrationTriggers: MigrationTriggers = MigrationTriggers(),

    @Type(JsonType::class)
    @Column(name = "conditions", nullable = false)
    val conditions: List<MigrationConditionNode> = emptyList(),

    /**
     * Cached, approximate count of cases matching this plan's [conditions], refreshed by the hourly
     * trigger sweep. Lets the UI show "cases to migrate" before a run starts (computing it live is
     * expensive). Null until first computed; once a run starts the execution's live count is
     * authoritative instead. Reset on redeploy and recomputed on the next sweep.
     */
    @Column(name = "estimated_cases_to_migrate")
    var estimatedCasesToMigrate: Int? = null,
) {

    /**
     * The blueprint version this plan migrates instances FROM, as a concrete [BlueprintId]. Always
     * the same blueprint *type* as the target: a case plan migrates cases, a building block plan
     * migrates building blocks.
     */
    fun sourceBlueprintId(): BlueprintId =
        BlueprintMigrationId.blueprintIdOf(id.blueprintType, sourceKey, sourceVersionTag)

    /** The blueprint version this plan migrates instances TO — the version it is deployed under. */
    fun targetBlueprintId(): BlueprintId = id.blueprintId()
}
