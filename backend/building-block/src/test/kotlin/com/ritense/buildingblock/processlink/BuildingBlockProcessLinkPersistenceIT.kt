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

package com.ritense.buildingblock.processlink

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import kotlin.test.assertEquals

class BuildingBlockProcessLinkPersistenceIT @Autowired constructor(
    private val processLinkRepository: ProcessLinkRepository,
    private val transactionTemplate: TransactionTemplate,
) : BaseIntegrationTest() {

    /**
     * Reproduces the JSONB/integer error seen when re-importing (overwriting) a case definition that
     * contains a building-block process-link.
     *
     * [BuildingBlockProcessLink] maps its JSONB columns (`input_mappings`, `output_mappings`,
     * `plugin_configuration_mappings`) on an `@SecondaryTable`. When that secondary row is
     * (re)written while updating an existing link, Hibernate performs the write with a native
     * PostgreSQL `MERGE` (upsert) on PostgreSQL 15+, rendering the JSONB columns as
     * `cast(? as integer)` and failing with:
     *
     *   column "input_mappings" is of type jsonb but expression is of type integer
     *
     * The fix marks the secondary row as non-optional so Hibernate uses a plain INSERT/UPDATE
     * instead of the MERGE upsert. This test overwrites an existing link with different mappings and
     * verifies the write succeeds and the mappings round-trip.
     */
    @Test
    fun `overwriting a building block process link with different mappings persists without error`() {
        val id = UUID.randomUUID()
        val definitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")

        val original = BuildingBlockProcessLink(
            id = id,
            processDefinitionId = "some-process-definition:1:$id",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = definitionId,
            pluginConfigurationMappings = mapOf("zaken" to UUID.randomUUID()),
            inputMappings = listOf(BuildingBlockInputMapping(source = "doc:/firstName", target = "firstName")),
            outputMappings = listOf(
                BuildingBlockOutputMapping(
                    source = "result",
                    target = "doc:/result",
                    syncTiming = BuildingBlockSyncTiming.END
                )
            )
        )

        transactionTemplate.execute { processLinkRepository.saveAndFlush(original) }

        val newPluginMappings = mapOf("zaken" to UUID.randomUUID())
        val newInputMappings = listOf(BuildingBlockInputMapping(source = "doc:/lastName", target = "lastName"))
        val newOutputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "result",
                target = "pv:result",
                syncTiming = BuildingBlockSyncTiming.CONTINUOUS
            )
        )

        // Overwrite the existing (detached) link: this triggers the secondary-table upsert that
        // failed with the JSONB/integer error before the fix.
        val overwritten = original.copy(
            pluginConfigurationMappings = newPluginMappings,
            inputMappings = newInputMappings,
            outputMappings = newOutputMappings
        )

        transactionTemplate.execute { processLinkRepository.saveAndFlush(overwritten) }

        val reloaded = transactionTemplate.execute {
            processLinkRepository.findById(id).orElseThrow()
        } as BuildingBlockProcessLink

        assertEquals(newPluginMappings, reloaded.pluginConfigurationMappings)
        assertEquals(newInputMappings, reloaded.inputMappings)
        assertEquals(newOutputMappings, reloaded.outputMappings)
    }
}
