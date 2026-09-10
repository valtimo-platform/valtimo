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

package com.ritense.buildingblock.processlink.domain

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Round-trips a [BuildingBlockProcessLink] through the database — insert, update, and reload — for
 * both a link that carries a plugin configuration mapping and one that does not. It guards the
 * `@SecondaryTable` `building_block_process_link` row whose `input_mappings` / `output_mappings` /
 * `plugin_configuration_mappings` are `jsonb`; that row is what a case-definition import using a
 * plugin configuration in a building-block mapping persists.
 *
 * Context: on Hibernate 6.6 the row was written through the optional-secondary-table upsert `MERGE`,
 * which mis-bound the json columns as `integer` ("column input_mappings is of type jsonb but
 * expression is of type integer"). [BuildingBlockProcessLink] now declares `@SecondaryRow`
 * (optional = false) so the row is always written with a plain INSERT/UPDATE.
 *
 * NB: this test exercises the same columns/entity but does not by itself reproduce that MERGE — the
 * failing statement is only emitted by the static-update autoflush the full import/deploy path
 * triggers (see BuildingBlockProcessLink's `@SecondaryRow` note); repository save/merge here binds
 * the json correctly regardless of the flag. It is a persistence round-trip guard, not a strict
 * regression test for the Hibernate binding.
 */
@Transactional
class BuildingBlockProcessLinkPersistenceIT @Autowired constructor(
    private val processLinkRepository: ProcessLinkRepository,
) : BaseIntegrationTest() {

    @PersistenceContext
    lateinit var entityManager: EntityManager

    @Test
    fun `inserts and updates a building-block process link that has a plugin configuration mapping`() {
        assertInsertAndUpdateRoundTrips(
            initialMappings = mapOf("external-plugin:case-summary@0.1.0" to UUID.randomUUID()),
            updatedMappings = mapOf("external-plugin:case-summary@0.1.0" to UUID.randomUUID()),
        )
    }

    @Test
    fun `inserts and updates a building-block process link without a plugin configuration mapping`() {
        assertInsertAndUpdateRoundTrips(
            initialMappings = emptyMap(),
            updatedMappings = emptyMap(),
        )
    }

    private fun assertInsertAndUpdateRoundTrips(
        initialMappings: Map<String, UUID>,
        updatedMappings: Map<String, UUID>,
    ) {
        val id = UUID.randomUUID()
        val processDefinitionId = "energy-subsidy-request:1:${UUID.randomUUID()}"
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("subsidy-calculator", "1.0.0")

        // INSERT the secondary row.
        processLinkRepository.saveAndFlush(
            buildingBlockProcessLink(id, processDefinitionId, buildingBlockDefinitionId, initialMappings, "doc:/before")
        )

        // UPDATE the secondary row (the mappings change), then reload and assert the json round-trips.
        processLinkRepository.saveAndFlush(
            buildingBlockProcessLink(id, processDefinitionId, buildingBlockDefinitionId, updatedMappings, "doc:/after")
        )
        entityManager.clear()

        val reloaded = processLinkRepository.findById(id).orElseThrow() as BuildingBlockProcessLink
        assertThat(reloaded.pluginConfigurationMappings).isEqualTo(updatedMappings)
        assertThat(reloaded.inputMappings).containsExactly(
            BuildingBlockInputMapping(source = "doc:/after", target = "target")
        )
        assertThat(reloaded.outputMappings).containsExactly(
            BuildingBlockOutputMapping(source = "result", target = "doc:/result", syncTiming = BuildingBlockSyncTiming.END)
        )
    }

    private fun buildingBlockProcessLink(
        id: UUID,
        processDefinitionId: String,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        pluginConfigurationMappings: Map<String, UUID>,
        inputSource: String,
    ) = BuildingBlockProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = "callActivity",
        activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
        buildingBlockDefinitionId = buildingBlockDefinitionId,
        pluginConfigurationMappings = pluginConfigurationMappings,
        inputMappings = listOf(BuildingBlockInputMapping(source = inputSource, target = "target")),
        outputMappings = listOf(
            BuildingBlockOutputMapping(source = "result", target = "doc:/result", syncTiming = BuildingBlockSyncTiming.END)
        ),
    )
}
