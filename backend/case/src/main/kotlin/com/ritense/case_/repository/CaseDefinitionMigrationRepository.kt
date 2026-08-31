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

    /**
     * All migration plans that migrate instances *away from* the given blueprint version — the plans
     * whose declared source it is.
     *
     * Read as a graph: every plan is an edge from the version it declares as its source to the version
     * it is deployed under, so this is the set of edges leaving a node. It is how
     * `BuildingBlockMigrationPathResolver` works out how a running building block gets from the version
     * it is on to the version its owner links, over as many plans as that takes.
     */
    fun findAllByIdBlueprintTypeAndSourceKeyAndSourceVersionTag(
        blueprintType: BlueprintType, sourceKey: String, sourceVersionTag: Semver
    ): List<CaseDefinitionMigration>

    /**
     * Plans of the given blueprint type that have never been run (no execution row yet). The trigger
     * scheduler uses this to find scheduled plans to auto-start, without loading plans that are already
     * running or finished, and to sweep case plans alone: a building block plan has no trigger of its
     * own — it runs when a case migration moves its building block onto the plan's version — so it must
     * never be auto-started.
     */
    @Query(
        "SELECT m FROM CaseDefinitionMigration m " +
            "WHERE m.id.blueprintType = :blueprintType " +
            "AND NOT EXISTS (SELECT 1 FROM CaseDefinitionMigrationExecution e WHERE e.id = m.id)"
    )
    fun findAllWithoutExecutionByBlueprintType(blueprintType: BlueprintType): List<CaseDefinitionMigration>
}
