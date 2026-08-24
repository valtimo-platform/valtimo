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
import java.io.IOException
import java.io.UncheckedIOException

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
    fun `an unasked-for source defaults to the predecessor the target records`() {
        val service = suggestionService(
            lineage = lineage(basedOn = "1.0.1", deployed = listOf("1.0.0", "1.0.1", "1.0.2")),
        )

        val plan = service.suggestPlan(target = target)

        assertThat(plan.get("source").get("key").asText()).isEqualTo("verhuizing")
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.1")
    }

    @Test
    fun `a target that records no predecessor falls back to the newest deployed version below it`() {
        // The shape of every version that was not drafted from another one in the admin UI: a file
        // auto-deploy records no `basedOnVersionTag`, and neither does the `-migrated` definition a
        // platform upgrade parks unmigrated instances on. Without the fallback the whole plan came
        // back as a skeleton with no source — and so no title, no key and no suggested components.
        val service = suggestionService(
            dataMigration = listOf(mapOf("target" to "doc:/adres")),
            lineage = lineage(basedOn = null, deployed = listOf("0.1.0-migrated", "1.0.0", "1.0.2")),
        )

        val plan = service.suggestPlan(target = target)

        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.0")
        // The point of finding a source at all: every component suggestion is a comparison with one.
        assertThat(plan.get("dataMigration")).hasSize(1)
    }

    @Test
    fun `the fallback orders versions as Semver, so a prerelease of the target sorts below it`() {
        // `aanvraag-algemene-bijstand-dcm` on the customer configuration: 1.0.0 alongside the
        // 0.1.0-migrated the upgrade left behind. As text `1.0.0-migrated` sorts *after* `1.0.0`.
        val service = suggestionService(
            lineage = lineage(basedOn = null, deployed = listOf("1.0.2-migrated", "1.0.2")),
        )

        val plan = service.suggestPlan(target = target)

        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.2-migrated")
    }

    @Test
    fun `a target that is the only version there is gets no source, and no components either`() {
        val service = suggestionService(
            dataMigration = listOf(mapOf("target" to "doc:/adres")),
            lineage = lineage(basedOn = null, deployed = listOf("1.0.2", "2.0.0")),
        )

        val plan = service.suggestPlan(target = target)

        assertThat(plan.has("source")).isFalse()
        assertThat(plan.has("dataMigration")).isFalse()
        // The skeleton still arrives, so the author can name a source themselves.
        assertThat(plan.get("migrationTriggers").get("triggeredByButton").asBoolean()).isTrue()
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


    @Test
    fun `a suggester that throws leaves its component out instead of failing the whole suggestion`() {
        // Seen in the field: a building block's document schema `$ref`d a file absent from the deployment,
        // the everit loader threw UncheckedIOException out of the dataMigration suggester, and
        // GET /suggestion answered 500 — so the editor got no plan at all and nothing said which component
        // was at fault. Suggestions are advisory by contract, so one broken component must cost only itself.
        val service = MigrationSuggestionService(
            objectMapper = objectMapper,
            versionLineages = emptyList(),
            componentSuggesters = listOf(
                throwingSuggester("dataMigration"),
                suggester("processMigration", listOf(mapOf("sourceProcessDefinitionKey" to "verhuizing"))),
            ),
            activityMappingSuggesters = emptyList(),
            activityMappingValidators = emptyList(),
            componentValidators = emptyList(),
        )

        val plan = service.suggestPlan(target = target, source = CaseDefinitionId("verhuizing", "1.0.1"))

        assertThat(plan.has("dataMigration")).isFalse()
        assertThat(plan.get("processMigration")).isNotNull()
        // The skeleton still arrives, so the editor can open the plan and the author can fill the rest in.
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.1")
        assertThat(plan.get("migrationTriggers").get("triggeredByButton").asBoolean()).isTrue()
    }

    private fun throwingSuggester(componentKey: String) = object : MigrationComponentSuggester {
        override fun componentKey() = componentKey
        override fun suggest(source: BlueprintId, target: BlueprintId): Any =
            throw UncheckedIOException(IOException("Could not find classpath://…/persoon.schema.json"))
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

    private fun lineage(
        exists: Boolean = true,
        basedOn: String? = null,
        deployed: List<String> = emptyList(),
    ) = object : BlueprintVersionLineage {
        override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.CASE
        override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? = basedOn?.let { Semver.parse(it) }
        override fun exists(blueprintId: BlueprintId) = exists
        override fun deployedVersionTags(blueprintId: BlueprintId) = deployed.map { Semver.parse(it)!! }
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
