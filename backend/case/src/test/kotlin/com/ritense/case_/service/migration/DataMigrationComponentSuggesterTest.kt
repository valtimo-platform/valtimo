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

package com.ritense.case_.service.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionRequest
import com.ritense.valueresolver.ValueResolverOptionType.FIELD
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class DataMigrationComponentSuggesterTest {

    private lateinit var valueResolverService: ValueResolverService
    private lateinit var suggester: DataMigrationComponentSuggester

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    @BeforeEach
    fun setUp() {
        valueResolverService = mock()
        suggester = DataMigrationComponentSuggester(valueResolverService)
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("dataMigration")
    }

    @Test
    fun `should suggest nothing when both versions expose the same paths`() {
        paths(source, "doc:/adres", "doc:/adres/straat")
        paths(target, "doc:/adres", "doc:/adres/straat")

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should clear a dropped object once instead of once per node beneath it`() {
        // The object container is a resolvable path of its own, so the walk yields it alongside every
        // descendant. Clearing the object removes the subtree; the descendants have nothing left to say.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/plaats", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(ClearingPatch(target = "doc:/adres"))
    }

    @Test
    fun `should clear the shallowest dropped object of a nested subtree`() {
        paths(source, "doc:/aanvrager", "doc:/aanvrager/adres", "doc:/aanvrager/adres/straat", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(ClearingPatch(target = "doc:/aanvrager"))
    }

    @Test
    fun `should still clear a dropped leaf of an object the target version keeps`() {
        // The object survives, so nulling it would take the fields the target still models with it.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/postcode")
        paths(target, "doc:/adres", "doc:/adres/straat")

        assertThat(suggest()).containsExactly(ClearingPatch(target = "doc:/adres/postcode"))
    }

    @Test
    fun `should not clear a path that was matched as the source of a copy`() {
        paths(source, "doc:/straatnaam")
        paths(target, "doc:/straat_naam")

        assertThat(suggest())
            .containsExactly(DataMigrationPatch(source = "doc:/straatnaam", target = "doc:/straat_naam"))
    }

    @Test
    fun `should surface a new target field with no source, and clear the object it replaces`() {
        paths(source, "doc:/adres", "doc:/adres/straat")
        paths(target, "doc:/woonplaats")

        assertThat(suggest()).containsExactly(
            ClearingPatch(target = "doc:/adres"),
            DataMigrationPatch(source = null, target = "doc:/woonplaats"),
        )
    }

    @Test
    fun `should order every patch by target path, whatever order the schema walk yields`() {
        // Copies and clears interleaved, and neither side enumerated alphabetically.
        paths(source, "doc:/zaak", "doc:/naam", "doc:/adres", "doc:/straatnaam")
        paths(target, "doc:/zaak", "doc:/bsn", "doc:/straat_naam")

        assertThat(suggest().map { targetOf(it) })
            .containsExactly("doc:/adres", "doc:/bsn", "doc:/naam", "doc:/straat_naam")
    }

    @Test
    fun `should write a clearing patch's null value out, so it is not the same row as an unfinished copy`() {
        // Both are "no source" to the applier, and that is fine — but only one of them is work the
        // author still has to do, and with `NON_NULL` on both they were the same three bytes on the wire.
        paths(source, "doc:/adres")
        paths(target, "doc:/woonplaats")

        assertThat(ObjectMapper().writeValueAsString(suggest()))
            .isEqualTo("""[{"target":"doc:/adres","value":null},{"target":"doc:/woonplaats"}]""")
    }

    @Test
    fun `should suggest nothing when the source resolves no path at all`() {
        // `verhuizing:9.9.9` — a source version that was never deployed. Every target path would come
        // back as a bare target, which the applier writes as a null: a plan that empties the document
        // field by field, dressed as the ordinary "fill this in" rows.
        paths(source)
        paths(target, "doc:/adres", "doc:/naam", "doc:/status")

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should copy the paths both sides have when the entry fills a separate document`() {
        // An `addBuildingBlock` entry moves data between two documents, and the block's starts empty, so
        // a shared path is the whole job rather than free. Read as one document it was skipped, and the
        // entry filled nothing — measured on `uitvoeren-business-services`, all 1480 of its paths shared.
        val block = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.0")
        paths(source, "doc:/adres", "doc:/naam")
        paths(block, "doc:/adres", "doc:/naam")

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isEqualTo(
            listOf(
                DataMigrationPatch(source = "doc:/adres", target = "doc:/adres"),
                DataMigrationPatch(source = "doc:/naam", target = "doc:/naam"),
            )
        )
    }

    @Test
    fun `should copy a shared subtree once at its root rather than once per node beneath it`() {
        // Copying `doc:/adres` carries the subtree with it, so a row per leaf re-does what the row above
        // already did. This is the difference between 1480 rows and 10 on a real building block.
        val block = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.0")
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/plaats", "doc:/naam")
        paths(block, "doc:/adres", "doc:/adres/straat", "doc:/adres/plaats", "doc:/naam")

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isEqualTo(
            listOf(
                DataMigrationPatch(source = "doc:/adres", target = "doc:/adres"),
                DataMigrationPatch(source = "doc:/naam", target = "doc:/naam"),
            )
        )
    }

    @Test
    fun `should keep a renamed copy into a subtree that is copied wholesale, and apply it after`() {
        // `doc:/adres` carries the shared subtree, then `doc:/adres/plaats` overwrites one field from a
        // differently-named source. The lexicographic sort is what puts the ancestor first.
        val block = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.0")
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/woonplaats")
        paths(block, "doc:/adres", "doc:/adres/straat", "doc:/adres/woonplaats")

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isEqualTo(
            listOf(
                DataMigrationPatch(source = "doc:/adres", target = "doc:/adres"),
                DataMigrationPatch(source = "doc:/woonplaats", target = "doc:/adres/woonplaats"),
            )
        )
    }

    @Test
    fun `should clear nothing when filling a separate document, which starts empty`() {
        val block = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.0")
        paths(source, "doc:/adres", "doc:/naam")
        paths(block, "doc:/naam")

        assertThat(suggester.suggestForBuildingBlockEntry(source, block))
            .isEqualTo(listOf(DataMigrationPatch(source = "doc:/naam", target = "doc:/naam")))
    }

    @Test
    fun `should suggest nothing for a building block that declares no fields`() {
        // Deliberate configuration: 52 of the 53 blocks on `aanvraag-ioaw-uitkering-dcm` ship
        // `"properties": {}`. There is nothing to fill and nothing to say about it — an empty tab.
        val block = BuildingBlockDefinitionId("bs-211-vaststelling-persoon", "1.0.0")
        paths(source, "doc:/adres", "doc:/naam")
        paths(block)

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isNull()
    }

    @Test
    fun `should treat a cross-key case migration as one document, not two`() {
        // The sharp edge of the rule: a different blueprint, but `DataMigrationComponentExecutor` applies
        // the patches with the case id as both source and target, so the content is carried over and a
        // shared path still needs no patch. Read as two documents, every plan would gain a redundant row.
        val other = CaseDefinitionId("woningdossier", "1.0.0")
        paths(source, "doc:/adres", "doc:/naam")
        paths(other, "doc:/adres", "doc:/naam")

        assertThat(suggester.suggest(source, other)).isNull()
    }

    @Test
    fun `should treat a building block migrating to its own next version as one document`() {
        val from = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.0")
        val to = BuildingBlockDefinitionId("uitvoeren-business-services", "1.0.1")
        paths(from, "doc:/adres", "doc:/naam")
        paths(to, "doc:/adres", "doc:/naam")

        assertThat(suggester.suggest(from, to)).isNull()
    }

    @Test
    fun `should treat a cross-key building block plan as one document, unlike a nested entry`() {
        // The pair the blueprint ids cannot separate, and the reason the caller has to say which it means:
        // this is `block -> block` and so is a nested entry, but a *plan* migrates one document from one
        // key to another and its patches are applied with that document id as both source and target.
        val from = BuildingBlockDefinitionId("bs-ophalen-brp", "1.0.0")
        val to = BuildingBlockDefinitionId("bs-raadplegen-brp", "1.0.0")
        paths(from, "doc:/adres", "doc:/naam")
        paths(to, "doc:/adres", "doc:/naam")

        assertThat(suggester.suggest(from, to)).isNull()
        assertThat(suggester.suggestForBuildingBlockEntry(from, to)).isEqualTo(
            listOf(
                DataMigrationPatch(source = "doc:/adres", target = "doc:/adres"),
                DataMigrationPatch(source = "doc:/naam", target = "doc:/naam"),
            )
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun suggest() = suggester.suggest(source, target) as List<Any>

    /** The target of either kind of suggested patch — a copy, or a clear. */
    private fun targetOf(patch: Any): String = when (patch) {
        is DataMigrationPatch -> patch.target
        is ClearingPatch -> patch.target
        else -> error("Unexpected suggestion '$patch'")
    }

    private fun paths(blueprintId: BlueprintId, vararg paths: String) {
        whenever(valueResolverService.getResolvableKeys(any<ValueResolverOptionRequest>(), eq(blueprintId)))
            .thenReturn(paths.map { ValueResolverOption(it, FIELD) })
    }
}
