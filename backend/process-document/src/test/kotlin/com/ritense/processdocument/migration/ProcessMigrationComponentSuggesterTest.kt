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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintProcessOwnership
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
    private val reachable = mutableMapOf<BlueprintId, Set<String>>()
    private val objectMapper = ObjectMapper()

    @BeforeEach
    fun setUp() {
        processActivityMapper = mock()
        // A process definition without a name falls back to its key, which is the common case and
        // keeps these tests about the keys alone.
        whenever(processActivityMapper.processDefinitionName(any())).thenReturn(null)
        whenever(processActivityMapper.suggestActivityMapping(any(), any())).thenReturn(emptyMap())
        suggester = ProcessMigrationComponentSuggester(
            resolvers(),
            processActivityMapper,
            listOf(object : BlueprintProcessOwnership {
                override fun supports(blueprintType: BlueprintType) = true
                override fun processesOfReachableBlueprints(blueprintId: BlueprintId) =
                    reachable[blueprintId].orEmpty()
            }),
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
    fun `should not guess at a rename within one blueprint, however close the names are`() {
        // The cost of this rule, stated as a test rather than left to be discovered: a process genuinely
        // renamed between two versions is no longer paired, even at 98% similarity. It is the same
        // evidence a wrong pairing offers, and only the author knows which of the two it is. The log
        // line names this candidate and its score, so adding the instruction by hand is one line.
        processes(source, "generic-update-zaakstatus-en-interne-status-plugin-v2")
        processes(target, "generic-update-zaakstatus-en-interne-status-plugin-v3")

        assertThat(suggestedPairs())
            .containsExactly("generic-update-zaakstatus-en-interne-status-plugin-v2" to null)
    }

    @Test
    fun `should surface the three live mispairings as blank targets instead of pairing them`() {
        // The three pairings a live run produced and an author would have accepted, each of which
        // would migrate a whole running process onto an unrelated one. Measured similarity 39-50%.
        processes(
            source,
            "uitvoeren-business-services",
            "generic-informeren-betrokkenen",
            "generic-update-zaakstatus-en-interne-status-plugin-v2",
        )
        processes(target, "ab-verversen-brongegevens", "ab-start-intrekken-aanvraag", "ab-taak-opnieuw-starten")

        // Surfaced with no target rather than paired: nothing here accounts for them, and an author who
        // sees three blank rows is being told the truth about what the plan does not know.
        assertThat(suggestedPairs()).containsExactly(
            "generic-informeren-betrokkenen" to null,
            "generic-update-zaakstatus-en-interne-status-plugin-v2" to null,
            "uitvoeren-business-services" to null,
        )
    }

    @Test
    fun `should say nothing about a process a building block the target declares now owns`() {
        // The relocated case: 87 of the 89 on `aanvraag-ioaw-uitkering-dcm`. The plan adopts it with an
        // addBuildingBlock entry, so a processMigration row for it would be work that fights that entry.
        reachableFromTarget("bs-opbouwen-uitgebreide-motivering")
        processes(source, "ab-afhandelen-aanvraag-dcm", "bs-opbouwen-uitgebreide-motivering")
        processes(target, "ab-afhandelen-aanvraag-dcm")

        assertThat(suggest())
            .containsExactly(instruction("ab-afhandelen-aanvraag-dcm", "ab-afhandelen-aanvraag-dcm"))
    }

    @Test
    fun `should suggest a process nobody accounts for with no target, so the author has to decide`() {
        // The other 2. Nothing owns it, so instances running it would be left behind in silence.
        processes(source, "ab-afhandelen-aanvraag-dcm", "bs-overwegen-uitzetten-informatieverzoek-v2")
        processes(target, "ab-afhandelen-aanvraag-dcm")

        assertThat(suggestedJson()).isEqualTo(
            """
            [
              {"sourceProcessDefinitionKey":"ab-afhandelen-aanvraag-dcm","targetProcessDefinitionKey":"ab-afhandelen-aanvraag-dcm","mapActivities":{},"setProcessVariables":[],"skipCustomListeners":false,"skipIoMappings":false},
              {"sourceProcessDefinitionKey":"bs-overwegen-uitzetten-informatieverzoek-v2","targetProcessDefinitionKey":null,"mapActivities":{}}
            ]
            """.compactJson()
        )
    }

    @Test
    fun `should treat everything as unaccounted for when nothing answers for building blocks`() {
        // No BlueprintProcessOwnership bean — a deployment with no building blocks. Relocation cannot
        // have happened, so every unmatched source is a genuine hole.
        suggester = ProcessMigrationComponentSuggester(resolvers(), processActivityMapper)
        processes(source, "bs-opbouwen-uitgebreide-motivering")
        processes(target, "ab-afhandelen-aanvraag-dcm")

        assertThat(suggestedJson()).contains("\"targetProcessDefinitionKey\":null")
    }

    @Test
    fun `should not pair a process that moved into a building block with the case process that starts it`() {
        // `aanvraag-ioaw-uitkering-dcm`, measured: the source version links 102 processes and the target
        // 13, because the upgrade moved the rest into building blocks. These eight pairings are what a
        // similarity threshold produced — they score 0.70 to 0.80, the band the previous calibration
        // read as "renamed" — and two of them failed 14 of 20 cases with Operaton ENGINE-23004. None of
        // the eight sources is a key the target owns, and all eight belong to blocks the target declares,
        // so all eight are accounted for by adoption and none of them is paired or surfaced.
        reachableFromTarget(
            "bs-opbouwen-uitgebreide-motivering",
            "bs-verwerken-buiten-behandeling-stelling",
            "bsb-behandeling-aanvraag-opnieuw-starten",
            "bsb-opbouwen-uitgebreide-motivering",
            "bsb-verwerken-buiten-behandeling-stelling",
            "generic-annuleren-informatieverzoek",
            "generic-vastleggen-reactie-informatieverzoek",
            "generic-verlengen-deadline-informatieverzoek",
        )
        processes(
            source,
            "bs-opbouwen-uitgebreide-motivering",
            "bs-verwerken-buiten-behandeling-stelling",
            "bsb-behandeling-aanvraag-opnieuw-starten",
            "bsb-opbouwen-uitgebreide-motivering",
            "bsb-verwerken-buiten-behandeling-stelling",
            "generic-annuleren-informatieverzoek",
            "generic-vastleggen-reactie-informatieverzoek",
            "generic-verlengen-deadline-informatieverzoek",
            // The one source that IS a case process, so the one instruction that should survive.
            "ioaw-afhandelen-aanvraag-dcm",
        )
        processes(
            target,
            "ioaw-afhandelen-aanvraag-dcm",
            "ioaw-start-uitgebreide-motivering",
            "ioaw-start-buiten-behandeling-stellen",
            "ioaw-start-behandeling-gehele-aanvraag-opnieuw",
            "ioaw-start-annuleren-informatieverzoek-dcm",
            "ioaw-start-reactie-informatieverzoek-dcm",
            "ioaw-start-verlengen-deadline-informatieverzoek-dcm",
        )

        assertThat(suggest())
            .containsExactly(instruction("ioaw-afhandelen-aanvraag-dcm", "ioaw-afhandelen-aanvraag-dcm"))
    }

    @Test
    fun `should pair the process that has a counterpart and leave the other one's target blank`() {
        processes(source, "ab-afhandelen-aanvraag-dcm", "uitvoeren-business-services")
        processes(target, "ab-afhandelen-aanvraag-dcm", "ab-verversen-brongegevens")

        assertThat(suggestedPairs()).containsExactly(
            "ab-afhandelen-aanvraag-dcm" to "ab-afhandelen-aanvraag-dcm",
            "uitvoeren-business-services" to null,
        )
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

    private fun resolvers() = listOf(object : ProcessDefinitionBlueprintResolver {
        override fun supports(blueprintType: BlueprintType) = true
        override fun resolveProcessDefinitions(blueprintId: BlueprintId) =
            deployedProcesses[blueprintId].orEmpty()
    })

    /** Processes the target reaches through the building blocks it declares. */
    private fun reachableFromTarget(vararg keys: String) {
        reachable[target] = keys.toSet()
    }

    /** (source, target) of every suggested row, target null where the suggester left it blank. */
    private fun suggestedPairs(): List<Pair<String, String?>> =
        objectMapper.valueToTree<JsonNode>(suggester.suggest(source, target)).map { node ->
            node.get("sourceProcessDefinitionKey").asText() to
                node.get("targetProcessDefinitionKey")?.takeIf { it.isTextual }?.asText()
        }

    /** The suggestion as the editor receives it — the shape is the point, a null target included. */
    private fun suggestedJson(): String =
        objectMapper.writeValueAsString(objectMapper.valueToTree<JsonNode>(suggester.suggest(source, target)))

    private fun String.compactJson(): String =
        objectMapper.writeValueAsString(objectMapper.readTree(this))

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
