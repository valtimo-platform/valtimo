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

package com.ritense.buildingblock.repository

import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface RemoveBuildingBlockConfigurationRepository :
    JpaRepository<RemoveBuildingBlockConfiguration, BlueprintMigrationId> {

    /**
     * Deletes the stored component **without reading it**, which every other route does: `findById`,
     * `deleteById` and `save` (a merge on an assigned id) all load the row first, and loading deserialises
     * its JSON into [RemoveBuildingBlockInstruction]s.
     *
     * Clearing a row on the way to replacing it does not need its contents, and not reading it is what
     * keeps a redeploy independent of whether the stored shape can still be parsed. That was not
     * hypothetical: when `buildingBlockVersionTag` became required, rows written without it could not be
     * deserialised, so re-deploying the *corrected* plan failed while clearing the stored copy of the old
     * one and the application did not start (§6.10). Reading those rows was then made possible again in its
     * own right (G29, [RemoveBuildingBlockInstruction]) — a plan has to be openable to be repairable — but
     * a delete that reads nothing is the right shape regardless, and it is the guard for the next
     * required field.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from RemoveBuildingBlockConfiguration configuration where configuration.id = :migrationId")
    fun deleteByMigrationId(@Param("migrationId") migrationId: BlueprintMigrationId)
}
