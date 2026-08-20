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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.processdocument.migration.ProcessMigrationActivityValidator
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class AddBuildingBlockProcessCheckerTest {

    private lateinit var activityValidator: ProcessMigrationActivityValidator
    private lateinit var checker: AddBuildingBlockProcessChecker

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")
    private val block = BuildingBlockDefinitionId.of("income-check", "1.0.0")

    private val deployedProcesses = mutableMapOf<BlueprintId, Map<String, String>>()
    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver

    @BeforeEach
    fun setUp() {
        activityValidator = mock()
        whenever(activityValidator.findInvalidActivityMappings(any(), any(), any())).thenReturn(emptyMap())
        deployedProcesses[source] = mapOf("verhuizing-process" to "verhuizing:1")
        deployedProcesses[target] = mapOf("verhuizing-process" to "verhuizing:2")
        deployedProcesses[block] = mapOf("income-check-process" to "income-check:1")
        linkResolver = mock()
        // Nothing linked on a call activity by default, so an entry with no processMigration is still dead.
        whenever(linkResolver.resolveCallActivityReachable(any())).thenReturn(emptySet())
        checker = AddBuildingBlockProcessChecker(
            listOf(fakeResolver(BlueprintType.CASE), fakeResolver(BlueprintType.BUILDING_BLOCK)),
            activityValidator,
            linkResolver,
        )
    }

    @Test
    fun `should find no problem with an entry naming a process on both ends`() {
        val instructions = listOf(instruction(hijack("verhuizing-process", "income-check-process")))

        assertThat(checker.findEntriesWithoutProcessMigration(target, instructions)).isEmpty()
        assertThat(checker.findUnresolvableProcesses(source, target, instructions)).isEmpty()
    }

    @Test
    fun `should find an entry with no process migration`() {
        assertThat(checker.findEntriesWithoutProcessMigration(target, listOf(instruction())))
            .singleElement().asString()
            .contains("adds building block 'income-check:1.0.0' without a 'processMigration'")
            .contains("does not declare it on a call activity either")
    }

    @Test
    fun `should accept an entry with no process migration when the target declares it on a call activity`() {
        whenever(linkResolver.resolveCallActivityReachable(target))
            .thenReturn(setOf(BuildingBlockDefinitionId.of("income-check", "1.0.0")))

        assertThat(checker.findEntriesWithoutProcessMigration(target, listOf(instruction()))).isEmpty()
    }

    /**
     * G31: the walk behind the closure is the dominant cost of migrating an instance, and the executor runs
     * this check per instance while needing the same closure itself. Passing it in has to actually skip the
     * walk, or the saving is imaginary.
     */
    @Test
    fun `should not walk the tree again when the caller already resolved the closure`() {
        val problems = checker.findEntriesWithoutProcessMigration(
            target, listOf(instruction()), callActivityReachable = setOf(block)
        )

        assertThat(problems).isEmpty() // the closure it was handed declares the block
        verify(linkResolver, never()).resolveCallActivityReachable(any())
    }

    @Test
    fun `should throw for an entry with no process migration`() {
        assertThatThrownBy { checker.assertHijacksSomething(target, listOf(instruction())) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("Migration plan for 'verhuizing:1.0.1'")
            .hasMessageContaining("without a 'processMigration'")
    }

    @Test
    fun `should not throw for an entry that names a process migration`() {
        assertThatCode {
            checker.assertHijacksSomething(
                target, listOf(instruction(hijack("verhuizing-process", "income-check-process")))
            )
        }.doesNotThrowAnyException()
    }

    @Test
    fun `should not throw when there are no entries at all`() {
        assertThatCode { checker.assertHijacksSomething(target, emptyList()) }.doesNotThrowAnyException()
    }

    @Test
    fun `should report a source process key neither end deploys`() {
        val instructions = listOf(instruction(hijack("verhuizing-proces", "income-check-process")))

        assertThat(checker.findUnresolvableProcesses(source, target, instructions))
            .singleElement().asString()
            .contains("taking over process 'verhuizing-proces'")
            .contains("Available: 'verhuizing-process'")
    }

    @Test
    fun `should accept a source process key only the target deploys`() {
        deployedProcesses[source] = emptyMap()
        val instructions = listOf(instruction(hijack("verhuizing-process", "income-check-process")))

        assertThat(checker.findUnresolvableProcesses(source, target, instructions)).isEmpty()
    }

    @Test
    fun `should report a target process key the block does not deploy`() {
        val instructions = listOf(instruction(hijack("verhuizing-process", "income-check-proces")))

        assertThat(checker.findUnresolvableProcesses(source, target, instructions))
            .singleElement().asString()
            .contains("migrating into process 'income-check-proces', which 'income-check:1.0.0' does not deploy")
            .contains("Available: 'income-check-process'")
    }

    @Test
    fun `should report an activity mapping the engine refuses, resolved against the target deployment`() {
        whenever(activityValidator.findInvalidActivityMappings("verhuizing:2", "income-check:1", mapOf("a" to "b")))
            .thenReturn(mapOf("a" to listOf("not migratable")))
        val instructions = listOf(
            instruction(hijack("verhuizing-process", "income-check-process", mapOf("a" to "b")))
        )

        assertThat(checker.findUnresolvableProcesses(source, target, instructions))
            .singleElement().asString()
            .contains("activity 'a': not migratable")
    }

    @Test
    fun `should stay silent when the added block version deploys nothing yet`() {
        deployedProcesses[block] = emptyMap()
        val instructions = listOf(instruction(hijack("verhuizing-process", "income-check-process")))

        assertThat(checker.findUnresolvableProcesses(source, target, instructions)).isEmpty()
    }

    @Test
    fun `should stay silent when neither blueprint resolves, rather than guess`() {
        deployedProcesses.clear()
        val instructions = listOf(instruction(hijack("anything", "at-all")))

        assertThat(checker.findUnresolvableProcesses(source, target, instructions)).isEmpty()
    }

    private fun instruction(vararg processMigration: ProcessMigrationInstruction) =
        AddBuildingBlockInstruction(
            buildingBlockKey = "income-check",
            buildingBlockVersionTag = "1.0.0",
            processMigration = processMigration.toList(),
        )

    private fun hijack(sourceKey: String, targetKey: String, mapActivities: Map<String, String> = emptyMap()) =
        ProcessMigrationInstruction(sourceKey, targetKey, mapActivities)

    private fun fakeResolver(type: BlueprintType) = object : ProcessDefinitionBlueprintResolver {
        override fun supports(blueprintType: BlueprintType) = blueprintType == type
        override fun resolveProcessDefinitions(blueprintId: BlueprintId) =
            deployedProcesses[blueprintId].orEmpty()
    }
}
