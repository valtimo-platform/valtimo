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

package com.ritense.processdocument.migration

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationInstruction
import org.operaton.bpm.engine.migration.MigrationInstructionsBuilder
import org.operaton.bpm.engine.migration.MigrationPlan
import org.operaton.bpm.engine.migration.MigrationPlanBuilder

class ChangedActivityMappingsTest {

    private val source = "main:1:aaa"
    private val target = "main:2:bbb"

    @Test
    fun `should drop an identity mapping the engine already makes, which would double-map its source`() {
        val runtimeService = engineMapping("task1", "gateway1")

        val result = runtimeService.changedActivityMappings(source, target, mapOf("task1" to "task1"))

        assertThat(result).isEmpty()
    }

    @Test
    fun `should keep an identity mapping the engine does not make, so a changed activity type still reports itself`() {
        // The engine skips a shared id whose type changed; dropping the author's too fails at run time instead.
        val runtimeService = engineMapping("gateway1")

        val result = runtimeService.changedActivityMappings(source, target, mapOf("task1" to "task1"))

        assertThat(result).containsExactlyEntriesOf(mapOf("task1" to "task1"))
    }

    @Test
    fun `should keep every mapping that renames an activity`() {
        val runtimeService = engineMapping("task1")

        val mapping = mapOf("oud" to "nieuw", "task1" to "task1")
        val result = runtimeService.changedActivityMappings(source, target, mapping)

        assertThat(result).containsExactlyEntriesOf(mapOf("oud" to "nieuw"))
    }

    @Test
    fun `should not ask the engine anything when no mapping is an identity`() {
        // The extra plan build is only ever needed to answer "did mapEqualActivities already do this?".
        val runtimeService = engineMapping("task1")

        val mapping = mapOf("oud" to "nieuw")
        assertThat(runtimeService.changedActivityMappings(source, target, mapping))
            .containsExactlyEntriesOf(mapping)
        verify(runtimeService, never()).createMigrationPlan(any(), any())
    }

    @Test
    fun `should keep every mapping when the engine cannot build even the equal-activity plan`() {
        val runtimeService = mock<RuntimeService>()
        whenever(runtimeService.createMigrationPlan(any(), any())).thenThrow(IllegalStateException("no such definition"))

        val mapping = mapOf("task1" to "task1")
        assertThat(runtimeService.changedActivityMappings(source, target, mapping))
            .containsExactlyEntriesOf(mapping)
    }

    /** A [RuntimeService] whose `mapEqualActivities()` plan maps exactly [equalSources] onto themselves. */
    private fun engineMapping(vararg equalSources: String): RuntimeService {
        // Each mock is finished before being passed: a nested mock() reads as an unfinished stubbing.
        val instructions = equalSources.map { id ->
            val instruction = mock<MigrationInstruction>()
            whenever(instruction.sourceActivityId).thenReturn(id)
            instruction
        }
        val plan = mock<MigrationPlan>()
        whenever(plan.instructions).thenReturn(instructions)

        val instructionsBuilder = mock<MigrationInstructionsBuilder>()
        whenever(instructionsBuilder.build()).thenReturn(plan)

        val planBuilder = mock<MigrationPlanBuilder>()
        whenever(planBuilder.mapEqualActivities()).thenReturn(instructionsBuilder)

        val runtimeService = mock<RuntimeService>()
        whenever(runtimeService.createMigrationPlan(any(), any())).thenReturn(planBuilder)
        return runtimeService
    }
}
