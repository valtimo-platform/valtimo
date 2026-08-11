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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver

class MigrationSuggestionServiceTest {

    private val objectMapper = ObjectMapper()

    @Test
    fun `a case plan suggestion carries a button trigger and an empty condition list`() {
        val service = suggestionService()

        val plan = service.suggestPlan(
            target = CaseDefinitionId("verhuizing", "1.0.2"),
            source = CaseDefinitionId("verhuizing", "1.0.1"),
        )

        assertThat(plan.get("migrationTriggers").get("triggeredByButton").asBoolean()).isTrue()
        assertThat(plan.get("conditions").isEmpty).isTrue()
        assertThat(plan.get("source").get("key").asText()).isEqualTo("verhuizing")
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.1")
    }

    @Test
    fun `a building block plan suggestion omits triggers and conditions`() {
        // A building block plan may not declare either — MigrationPlanImporter refuses both — so
        // suggesting them would hand the author a plan that cannot be saved.
        val service = suggestionService()

        val plan = service.suggestPlan(
            target = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4"),
            source = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.3"),
        )

        assertThat(plan.has("migrationTriggers")).isFalse()
        assertThat(plan.has("conditions")).isFalse()
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.3")
    }

    @Test
    fun `a building block entry suggestion fills data and process migration for the pair`() {
        // The owner of a nested building block is itself a building block, so the entry suggestion has
        // to work for a building-block owner exactly as it does for a case one.
        val owner = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
        val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")
        val service = suggestionService(
            dataMigration = listOf(
                mapOf("source" to "doc:/adres", "target" to "doc:/adres"),
                // A null-write clears a field on ONE document; it means nothing when copying between
                // two, so only copy patches survive into a building-block entry.
                mapOf("value" to null, "target" to "doc:/oudAdres"),
            ),
            processMigration = listOf(mapOf("sourceProcessDefinitionKey" to "inspectie")),
        )

        val suggestion = service.suggestBuildingBlockEntry(owner, nested)

        assertThat(suggestion.get("dataMigration")).hasSize(1)
        assertThat(suggestion.get("dataMigration").first().get("target").asText()).isEqualTo("doc:/adres")
        assertThat(suggestion.get("processMigration")).hasSize(1)
    }

    @Test
    fun `a plan that declares no source cannot be saved`() {
        val service = suggestionService()

        val problems = service.findPlanProblems(target, objectMapper.readTree("""{"key": "x"}"""))

        assertThat(problems).singleElement().asString().contains("no valid 'source'")
    }

    @Test
    fun `a plan whose source version is not a semantic version cannot be saved`() {
        val service = suggestionService()
        val plan = objectMapper.readTree("""{"key": "x", "source": {"versionTag": "gisteren"}}""")

        val problems = service.findPlanProblems(target, plan)

        assertThat(problems).singleElement().asString().contains("no valid 'source'")
    }

    @Test
    fun `a plan naming a source nobody deployed cannot be saved`() {
        // Checked here rather than at file import: on this path every definition is already deployed,
        // and a source that is not would select no instances at all — a silence worth an error.
        val service = suggestionService(lineage = lineage(exists = false))
        val plan = objectMapper.readTree("""{"key": "x", "source": {"versionTag": "1.0.1"}}""")

        val problems = service.findPlanProblems(target, plan)

        assertThat(problems).singleElement().asString().contains("is not deployed")
    }

    @Test
    fun `components are validated against the source the plan declares, key included`() {
        // The source is read off the plan, not derived from the target, so a cross-key plan is
        // validated against the other case definition rather than against this one's predecessor.
        val validated = mutableListOf<BlueprintId>()
        val service = suggestionService(
            lineage = lineage(exists = true),
            componentValidator = validator("dataMigration") { source -> validated += source },
        )
        val plan = objectMapper.readTree(
            """{"key": "x", "source": {"key": "verhuizing-oud", "versionTag": "2.3.4"}, "dataMigration": []}"""
        )

        val problems = service.findPlanProblems(target, plan)

        assertThat(validated).containsExactly(CaseDefinitionId("verhuizing-oud", "2.3.4"))
        assertThat(problems).containsExactly("boom")
    }

    private val target = CaseDefinitionId("verhuizing", "1.0.2")

    private fun suggestionService(
        dataMigration: Any? = null,
        processMigration: Any? = null,
        lineage: BlueprintVersionLineage? = null,
        componentValidator: MigrationComponentValidator? = null,
    ) = MigrationSuggestionService(
        objectMapper = objectMapper,
        versionLineages = listOfNotNull(lineage),
        componentSuggesters = listOfNotNull(
            dataMigration?.let { suggester("dataMigration", it) },
            processMigration?.let { suggester("processMigration", it) },
        ),
        activityMappingSuggesters = emptyList(),
        activityMappingValidators = emptyList(),
        componentValidators = listOfNotNull(componentValidator),
    )

    private fun suggester(componentKey: String, suggestion: Any) = object : MigrationComponentSuggester {
        override fun componentKey() = componentKey
        override fun suggest(source: BlueprintId, target: BlueprintId) = suggestion
    }

    private fun lineage(exists: Boolean) = object : BlueprintVersionLineage {
        override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.CASE
        override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? = null
        override fun exists(blueprintId: BlueprintId) = exists
    }

    private fun validator(componentKey: String, onValidate: (BlueprintId) -> Unit) =
        object : MigrationComponentValidator {
            override fun componentKey() = componentKey
            override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
                onValidate(source)
                return listOf("boom")
            }
        }
}
