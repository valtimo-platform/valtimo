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

package com.ritense.case_.repository

import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import org.semver4j.Semver
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CaseDefinitionMigrationRepository :
    JpaRepository<CaseDefinitionMigration, BlueprintMigrationId> {

    /** All migration plans that target the given blueprint (type + key + version). */
    fun findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
        blueprintType: BlueprintType, key: String, versionTag: Semver
    ): List<CaseDefinitionMigration>

    /** The plans whose declared source is this version — the edges leaving a node, which is how [BuildingBlockMigrationPathResolver] chains a block onto the version its owner links. */
    fun findAllByIdBlueprintTypeAndSourceKeyAndSourceVersionTag(
        blueprintType: BlueprintType, sourceKey: String, sourceVersionTag: Semver
    ): List<CaseDefinitionMigration>

    /** Plans of the given type that have never been run. Case plans only: a building block plan has no trigger of its own and must never be auto-started. */
    @Query(
        "SELECT m FROM CaseDefinitionMigration m " +
            "WHERE m.id.blueprintType = :blueprintType " +
            "AND NOT EXISTS (SELECT 1 FROM CaseDefinitionMigrationExecution e WHERE e.id = m.id)"
    )
    fun findAllWithoutExecutionByBlueprintType(blueprintType: BlueprintType): List<CaseDefinitionMigration>
}
