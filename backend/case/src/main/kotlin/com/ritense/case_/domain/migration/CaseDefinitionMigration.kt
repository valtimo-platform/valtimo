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

/** The plan-level skeleton: the version it migrates FROM, its title, triggers and conditions. The actions live in components owned by other modules. Triggers and conditions are case-only. */
@Entity
@Table(name = "blueprint_migration")
data class CaseDefinitionMigration(

    @EmbeddedId
    val id: BlueprintMigrationId,

    /** The key of the blueprint version this plan migrates FROM — not necessarily [id]'s, since a plan may move instances onto a differently-keyed blueprint. */
    @Column(name = "source_blueprint_key", nullable = false)
    val sourceKey: String,

    /** The version this plan migrates FROM — any earlier one, so a plan may move its instances several versions in one step. */
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

    /** Cached, approximate count of matching cases, refreshed by the hourly sweep so the UI need not compute it live. Once a run starts its live count is authoritative. */
    @Column(name = "estimated_cases_to_migrate")
    var estimatedCasesToMigrate: Int? = null,
) {

    /** The version this plan migrates FROM, as a [BlueprintId]. Always the same blueprint type as the target. */
    fun sourceBlueprintId(): BlueprintId =
        BlueprintMigrationId.blueprintIdOf(id.blueprintType, sourceKey, sourceVersionTag)

    /** The blueprint version this plan migrates instances TO — the version it is deployed under. */
    fun targetBlueprintId(): BlueprintId = id.blueprintId()
}
