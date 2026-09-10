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
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentDefinitionService
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
import java.util.Optional

class DataMigrationComponentSuggesterTest {

    private lateinit var valueResolverService: ValueResolverService
    private lateinit var documentDefinitionService: DocumentDefinitionService
    private lateinit var suggester: DataMigrationComponentSuggester

    private val source = CaseDefinitionId("verhuizing", "1.0.0")
    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    @BeforeEach
    fun setUp() {
        valueResolverService = mock()
        documentDefinitionService = mock()
        // No schema unless a test deploys one: an undeclared type is what leaves `targetType` off.
        whenever(documentDefinitionService.findByBlueprintId(any())).thenReturn(Optional.empty())
        suggester = DataMigrationComponentSuggester(valueResolverService, documentDefinitionService)
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
        // The container is a resolvable path of its own; clearing it removes the subtree, so descendants have nothing left to say.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/plaats", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(DataMigrationPatch(target = "doc:/adres"))
    }

    @Test
    fun `should clear the shallowest dropped object of a nested subtree`() {
        paths(source, "doc:/aanvrager", "doc:/aanvrager/adres", "doc:/aanvrager/adres/straat", "doc:/naam")
        paths(target, "doc:/naam")

        assertThat(suggest()).containsExactly(DataMigrationPatch(target = "doc:/aanvrager"))
    }

    @Test
    fun `should still clear a dropped leaf of an object the target version keeps`() {
        // The object survives, so nulling it would take the fields the target still models with it.
        paths(source, "doc:/adres", "doc:/adres/straat", "doc:/adres/postcode")
        paths(target, "doc:/adres", "doc:/adres/straat")

        assertThat(suggest()).containsExactly(DataMigrationPatch(target = "doc:/adres/postcode"))
    }

    @Test
    fun `should not clear a path that was matched as the source of a copy`() {
        paths(source, "doc:/straatnaam")
        paths(target, "doc:/straat_naam")

        assertThat(suggest())
            .containsExactly(DataMigrationPatch(source = "doc:/straatnaam", target = "doc:/straat_naam"))
    }

    @Test
    fun `should clear the object a new target field replaces, without suggesting the new field itself`() {
        // A bare `doc:/woonplaats` would null the field, not hand the author a blank to fill in.
        paths(source, "doc:/adres", "doc:/adres/straat")
        paths(target, "doc:/woonplaats")

        assertThat(suggest()).containsExactly(DataMigrationPatch(target = "doc:/adres"))
    }

    @Test
    fun `should not suggest a target field no source path matches`() {
        paths(source, "doc:/adres")
        paths(target, "doc:/adres", "doc:/woonplaats")

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should order every patch by target path, whatever order the schema walk yields`() {
        // Copies and clears interleaved, neither side alphabetical. `doc:/bsn` matches nothing.
        paths(source, "doc:/zaak", "doc:/naam", "doc:/adres", "doc:/straatnaam")
        paths(target, "doc:/zaak", "doc:/bsn", "doc:/straat_naam")

        assertThat(suggest().map { it.target })
            .containsExactly("doc:/adres", "doc:/naam", "doc:/straat_naam")
    }

    @Test
    fun `should write a clear as the target-only shape the engine and the editor both read as a null write`() {
        // The one shape a save keeps — `NON_NULL` drops an explicit `value: null`.
        paths(source, "doc:/adres")
        paths(target, "doc:/woonplaats")

        assertThat(ObjectMapper().writeValueAsString(suggest()))
            .isEqualTo("""[{"target":"doc:/adres"}]""")
    }

    @Test
    fun `should suggest nothing when the source resolves no path at all`() {
        // `verhuizing:9.9.9` was never deployed, so there is nothing to match against and nothing to clear.
        paths(source)
        paths(target, "doc:/adres", "doc:/naam", "doc:/status")

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should copy the paths both sides have when the entry fills a separate document`() {
        // A block's document starts empty, so a shared path is the whole job. Read as one document the entry filled nothing — all 1480 paths of `uitvoeren-business-services` are shared.
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
        // Copying `doc:/adres` carries the subtree, so a row per leaf re-does it. 1480 rows against 10.
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
        // `doc:/adres` carries the subtree, then `doc:/adres/plaats` overwrites one field. The lexicographic sort puts the ancestor first.
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
        // 52 of the 53 blocks on `aanvraag-ioaw-uitkering-dcm` ship `"properties": {}` — nothing to fill and nothing to say.
        val block = BuildingBlockDefinitionId("bs-211-vaststelling-persoon", "1.0.0")
        paths(source, "doc:/adres", "doc:/naam")
        paths(block)

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isNull()
    }

    @Test
    fun `should treat a cross-key case migration as one document, not two`() {
        // The sharp edge: a different blueprint, but the executor applies the patches with the case id as both ends, so the content is carried over and a shared path still needs no patch.
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
        // The pair the blueprint ids cannot separate: this is `block -> block` and so is a nested entry, but a plan migrates one document from one key to another.
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

    // targetType — suggested only where the two schemas disagree about the type (G77)

    @Test
    fun `should type a copy the target version declares differently from the source`() {
        paths(source, "doc:/aantalPersonen")
        paths(target, "doc:/aantal_personen")
        schema(source, """"aantalPersonen": { "type": "string" }""")
        schema(target, """"aantal_personen": { "type": "integer" }""")

        assertThat(suggest()).containsExactly(
            DataMigrationPatch(
                source = "doc:/aantalPersonen",
                target = "doc:/aantal_personen",
                targetType = "integer",
            )
        )
    }

    @Test
    fun `should leave a copy untyped when both versions declare the same type`() {
        // Naming the type a value already has coerces nothing, and would put a field on nearly every patch.
        paths(source, "doc:/aantalPersonen")
        paths(target, "doc:/aantal_personen")
        schema(source, """"aantalPersonen": { "type": "integer" }""")
        schema(target, """"aantal_personen": { "type": "integer" }""")

        assertThat(suggest()).containsExactly(
            DataMigrationPatch(source = "doc:/aantalPersonen", target = "doc:/aantal_personen")
        )
    }

    @Test
    fun `should tell integer from number, which coerce differently`() {
        paths(source, "doc:/oppervlakte")
        paths(target, "doc:/opper_vlakte")
        schema(source, """"oppervlakte": { "type": "integer" }""")
        schema(target, """"opper_vlakte": { "type": "number" }""")

        assertThat(suggest().single().targetType).isEqualTo("number")
    }

    @Test
    fun `should leave a copy untyped when either side leaves the type open`() {
        // Nothing to coerce to. Guessing would convert a value the author never asked to convert.
        paths(source, "doc:/gegevens", "doc:/naam")
        paths(target, "doc:/gegevens_v2", "doc:/naam_v2")
        schema(source, """"gegevens": { "type": "object" }, "naam": { "type": "string" }""")
        schema(target, """"gegevens_v2": { "type": "string" }, "naam_v2": {}""")

        assertThat(suggest().map { it.targetType }).containsOnlyNulls()
    }

    @Test
    fun `should type a shared path the two documents of an entry declare differently`() {
        // The block's schema is a second document, so a shared path can be a different type on each side.
        val block = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.0")
        paths(source, "doc:/inspectieStatus")
        paths(block, "doc:/inspectieStatus")
        schema(source, """"inspectieStatus": { "type": "integer" }""")
        schema(block, """"inspectieStatus": { "type": "string" }""")

        assertThat(suggester.suggestForBuildingBlockEntry(source, block)).isEqualTo(
            listOf(
                DataMigrationPatch(
                    source = "doc:/inspectieStatus",
                    target = "doc:/inspectieStatus",
                    targetType = "string",
                )
            )
        )
    }

    /** `"type": ["integer", "null"]` is how nearly every optional field in these schemas is written; read as "type unknown" the rule would fire on almost nothing. */
    @Test
    fun `should see through a nullable union to the type it coerces to`() {
        paths(source, "doc:/aantalPersonen", "doc:/verhuisstatus")
        paths(target, "doc:/aantal_personen", "doc:/verhuis_status")
        schema(source, """"aantalPersonen": { "type": ["string", "null"] }, "verhuisstatus": { "type": "string" }""")
        schema(target, """"aantal_personen": { "type": ["integer", "null"] }, "verhuis_status": { "type": ["string", "null"] }""")

        assertThat(suggest()).containsExactly(
            // string -> integer across two unions.
            DataMigrationPatch(
                source = "doc:/aantalPersonen",
                target = "doc:/aantal_personen",
                targetType = "integer",
            ),
            // string -> nullable string is the same type; nullability is not a coercion.
            DataMigrationPatch(source = "doc:/verhuisstatus", target = "doc:/verhuis_status"),
        )
    }

    @Test
    fun `should leave a copy untyped when a union's alternatives disagree`() {
        paths(source, "doc:/waarde")
        paths(target, "doc:/waarde_v2")
        schema(source, """"waarde": { "type": ["string", "integer"] }""")
        schema(target, """"waarde_v2": { "type": "integer" }""")

        assertThat(suggest().single().targetType).isNull()
    }

    @Test
    fun `should never type a clear, which writes null whatever the schema says`() {
        paths(source, "doc:/aantalPersonen")
        paths(target, "doc:/onvergelijkbaar")
        schema(source, """"aantalPersonen": { "type": "integer" }""")
        schema(target, """"onvergelijkbaar": { "type": "string" }""")

        assertThat(suggest()).containsExactly(DataMigrationPatch(target = "doc:/aantalPersonen"))
    }

    @Suppress("UNCHECKED_CAST")
    private fun suggest() = suggester.suggest(source, target) as List<DataMigrationPatch>

    private fun paths(blueprintId: BlueprintId, vararg paths: String) {
        whenever(valueResolverService.getResolvableKeys(any<ValueResolverOptionRequest>(), eq(blueprintId)))
            .thenReturn(paths.map { ValueResolverOption(it, FIELD) })
    }

    /** Deploy a document definition for [blueprintId] whose schema declares [properties]. */
    private fun schema(blueprintId: BlueprintId, properties: String) {
        val name = blueprintId.getIdKey()
        val id = when (blueprintId) {
            is CaseDefinitionId -> JsonSchemaDocumentDefinitionId.forCase(name, blueprintId)
            else -> JsonSchemaDocumentDefinitionId.forBuildingBlock(
                name, blueprintId as BuildingBlockDefinitionId
            )
        }
        // The constructor asserts the schema's `$id` is `<name>.schema`.
        val definition = JsonSchemaDocumentDefinition(
            id,
            JsonSchema.fromString(
                """
                {
                  "${'$'}id": "$name.schema",
                  "${'$'}schema": "http://json-schema.org/draft-07/schema#",
                  "type": "object",
                  "properties": { $properties }
                }
                """.trimIndent()
            )
        )
        whenever(documentDefinitionService.findByBlueprintId(eq(blueprintId)))
            .thenReturn(Optional.of(definition))
    }
}
