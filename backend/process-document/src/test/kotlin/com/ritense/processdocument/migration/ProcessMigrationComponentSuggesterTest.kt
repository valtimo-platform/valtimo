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

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.semver4j.Semver

class ProcessMigrationComponentSuggesterTest {

    private lateinit var processActivityMapper: ProcessActivityMapper
    private lateinit var suggester: ProcessMigrationComponentSuggester

    private val source = CaseDefinitionId("aanvraag-algemene-bijstand-dcm", "0.1.0")
    private val target = CaseDefinitionId("aanvraag-algemene-bijstand-dcm", "1.0.0")

    private val deployedProcesses = mutableMapOf<BlueprintId, Map<String, String>>()

    @BeforeEach
    fun setUp() {
        processActivityMapper = mock()
        // A process definition without a name falls back to its key, which is the common case and
        // keeps these tests about the keys alone.
        whenever(processActivityMapper.processDefinitionName(any())).thenReturn(null)
        whenever(processActivityMapper.suggestActivityMapping(any(), any())).thenReturn(emptyMap())
        suggester = ProcessMigrationComponentSuggester(
            listOf(object : ProcessDefinitionBlueprintResolver {
                override fun supports(blueprintType: BlueprintType) = true
                override fun resolveProcessDefinitions(blueprintId: BlueprintId) =
                    deployedProcesses[blueprintId].orEmpty()
            }),
            processActivityMapper,
        )
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("processMigration")
    }

    @Test
    fun `should map a process that kept its key onto itself`() {
        processes(source, "ab-afhandelen-aanvraag-dcm")
        processes(target, "ab-afhandelen-aanvraag-dcm")

        assertThat(suggest())
            .containsExactly(instruction("ab-afhandelen-aanvraag-dcm", "ab-afhandelen-aanvraag-dcm"))
    }

    @Test
    fun `should map a renamed process onto its rename`() {
        processes(source, "generic-update-zaakstatus-en-interne-status-plugin-v2")
        processes(target, "generic-update-zaakstatus-en-interne-status-plugin-v3")

        assertThat(suggest()).containsExactly(
            instruction(
                "generic-update-zaakstatus-en-interne-status-plugin-v2",
                "generic-update-zaakstatus-en-interne-status-plugin-v3",
            )
        )
    }

    @Test
    fun `should suggest nothing for a source process the next version of the same blueprint does not have`() {
        // The three pairings a live run produced and an author would have accepted, each of which
        // would migrate a whole running process onto an unrelated one. Measured similarity 39-50%.
        processes(
            source,
            "uitvoeren-business-services",
            "generic-informeren-betrokkenen",
            "generic-update-zaakstatus-en-interne-status-plugin-v2",
        )
        processes(target, "ab-verversen-brongegevens", "ab-start-intrekken-aanvraag", "ab-taak-opnieuw-starten")

        assertThat(suggest()).isNull()
    }

    @Test
    fun `should keep the processes that do have a counterpart and drop only the one that does not`() {
        processes(source, "ab-afhandelen-aanvraag-dcm", "uitvoeren-business-services")
        processes(target, "ab-afhandelen-aanvraag-dcm", "ab-verversen-brongegevens")

        assertThat(suggest())
            .containsExactly(instruction("ab-afhandelen-aanvraag-dcm", "ab-afhandelen-aanvraag-dcm"))
    }

    @Test
    fun `should not judge similarity across blueprints, where an owner and its building block share no key`() {
        // `suggestBuildingBlockEntry` maps the owner's running process onto the block's process. Those
        // keys have nothing in common by nature (this pair scores 26%), and the author declared the
        // pairing by writing the entry, so the nearest match is kept whatever it scores.
        val block = buildingBlock("uitvoeren-business-services", "1.0.0")
        processes(source, "ab-afhandelen-aanvraag-dcm")
        processes(block, "uitvoeren-business-services")

        assertThat(suggester.suggest(source, block))
            .isEqualTo(listOf(instruction("ab-afhandelen-aanvraag-dcm", "uitvoeren-business-services")))
    }

    @Test
    fun `should not judge similarity across case definition keys either`() {
        val other = CaseDefinitionId("woningdossier", "1.0.0")
        processes(source, "ab-afhandelen-aanvraag-dcm")
        processes(other, "woningdossier-behandelen")

        assertThat(suggester.suggest(source, other))
            .isEqualTo(listOf(instruction("ab-afhandelen-aanvraag-dcm", "woningdossier-behandelen")))
    }

    @Test
    fun `should prefer an exact key match over a target that is merely similar`() {
        processes(source, "ab-afhandelen-aanvraag")
        processes(target, "ab-afhandelen-aanvraag-dcm", "ab-afhandelen-aanvraag")

        assertThat(suggest())
            .containsExactly(instruction("ab-afhandelen-aanvraag", "ab-afhandelen-aanvraag"))
    }

    @Test
    fun `should order the instructions by source process key, whatever order the resolver answers in`() {
        processes(source, "zorg-proces", "afhandelen-proces", "melden-proces")
        processes(target, "zorg-proces", "afhandelen-proces", "melden-proces")

        assertThat(suggest()?.map { it.sourceProcessDefinitionKey })
            .containsExactly("afhandelen-proces", "melden-proces", "zorg-proces")
    }

    @Test
    fun `should suggest nothing when the target version deploys no process at all`() {
        processes(source, "ab-afhandelen-aanvraag-dcm")
        processes(target)

        assertThat(suggest()).isNull()
    }

    @Suppress("UNCHECKED_CAST")
    private fun suggest() = suggester.suggest(source, target) as List<ProcessMigrationInstruction>?

    private fun instruction(sourceKey: String, targetKey: String) = ProcessMigrationInstruction(
        sourceProcessDefinitionKey = sourceKey,
        targetProcessDefinitionKey = targetKey,
        mapActivities = emptyMap(),
    )

    private fun processes(blueprintId: BlueprintId, vararg keys: String) {
        deployedProcesses[blueprintId] = keys.associateWith { "$it:1:${keys.indexOf(it)}" }
    }

    /** A building block version, without depending on the building-block module for its id type. */
    private fun buildingBlock(key: String, version: String) = object : BlueprintId {
        override fun getTagPrefix() = "BB"
        override fun getIdKey() = key
        override fun blueprintType() = BlueprintType.BUILDING_BLOCK
        override fun blueprintVersionTag(): Semver = Semver.parse(version)!!
        override fun toString() = "BB:$key:$version"
    }
}
