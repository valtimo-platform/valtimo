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
import com.ritense.valtimo.contract.blueprint.migration.BuildingBlockEntryOwnership
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
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
        // The importer refuses both on a building block plan, so suggesting them would hand the author an unsaveable plan.
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
    fun `should drop a blank process row an addBuildingBlock entry hijacks`() {
        // Two components answering the same question differently, and the blank row is what made the plan unsaveable (G73).
        val service = suggestionService(
            processMigration = listOf(
                mapOf("sourceProcessDefinitionKey" to "inspectie-dossier-process"),
                mapOf("sourceProcessDefinitionKey" to "verhuizing", "targetProcessDefinitionKey" to "verhuizing"),
            ),
            addBuildingBlock = listOf(
                mapOf(
                    "buildingBlockKey" to "inspectie-dossier",
                    "buildingBlockVersionTag" to "1.0.0",
                    "processMigration" to listOf(
                        mapOf(
                            "sourceProcessDefinitionKey" to "inspectie-dossier-process",
                            "targetProcessDefinitionKey" to "inspectie-dossier-process",
                        )
                    ),
                )
            ),
        )

        val plan = service.suggestPlan(
            target = CaseDefinitionId("verhuizing", "1.0.11"),
            source = CaseDefinitionId("verhuizing", "1.0.10"),
        )

        assertThat(plan.get("processMigration").map { it.get("sourceProcessDefinitionKey").asText() })
            .containsExactly("verhuizing")
    }

    @Test
    fun `should keep a resolved process row an addBuildingBlock entry also hijacks`() {
        // processMigration (@200) may move the owner's process before addBuildingBlock (@300) takes it over.
        val service = suggestionService(
            processMigration = listOf(
                mapOf("sourceProcessDefinitionKey" to "verhuizing", "targetProcessDefinitionKey" to "verhuizing")
            ),
            addBuildingBlock = listOf(
                mapOf(
                    "buildingBlockKey" to "inspectie-fotos",
                    "buildingBlockVersionTag" to "1.0.0",
                    "processMigration" to listOf(
                        mapOf(
                            "sourceProcessDefinitionKey" to "verhuizing",
                            "targetProcessDefinitionKey" to "inspectie-fotos-process",
                        )
                    ),
                )
            ),
        )

        val plan = service.suggestPlan(
            target = CaseDefinitionId("verhuizing", "1.0.3"),
            source = CaseDefinitionId("verhuizing", "1.0.0"),
        )

        assertThat(plan.get("processMigration")).hasSize(1)
    }

    @Test
    fun `should keep a blank process row no entry hijacks`() {
        // Nothing accounts for it, so the author still needs to see it — that is what G59 left it in for.
        val service = suggestionService(
            processMigration = listOf(mapOf("sourceProcessDefinitionKey" to "verhuizing-nazorg")),
            addBuildingBlock = listOf(
                mapOf("buildingBlockKey" to "inspectie-fotos", "buildingBlockVersionTag" to "1.0.0")
            ),
        )

        val plan = service.suggestPlan(
            target = CaseDefinitionId("verhuizing", "1.0.3"),
            source = CaseDefinitionId("verhuizing", "1.0.0"),
        )

        assertThat(plan.get("processMigration")).hasSize(1)
    }

    @Test
    fun `should leave out processMigration entirely when every row was hijacked`() {
        val service = suggestionService(
            processMigration = listOf(mapOf("sourceProcessDefinitionKey" to "inspectie-dossier-process")),
            addBuildingBlock = listOf(
                mapOf(
                    "buildingBlockKey" to "inspectie-dossier",
                    "buildingBlockVersionTag" to "1.0.0",
                    "processMigration" to listOf(
                        mapOf(
                            "sourceProcessDefinitionKey" to "inspectie-dossier-process",
                            "targetProcessDefinitionKey" to "inspectie-dossier-process",
                        )
                    ),
                )
            ),
        )

        val plan = service.suggestPlan(
            target = CaseDefinitionId("verhuizing", "1.0.11"),
            source = CaseDefinitionId("verhuizing", "1.0.10"),
        )

        assertThat(plan.has("processMigration")).isFalse()
    }

    @Test
    fun `a building block entry suggestion fills data and process migration for the pair`() {
        // A nested block's owner is itself a building block, so the entry suggestion must work for one.
        val owner = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
        val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")
        val service = suggestionService(
            dataMigration = listOf(
                mapOf("source" to "doc:/adres", "target" to "doc:/adres"),
                // A null-write clears a field on one document and means nothing across two, so only copies survive.
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
    fun `an entry suggests its process migration against the owner as the instances still have it`() {
        // The two components stage differently: `dataMigration` runs at @100, so by @300 the document is the target version's, while the process to hijack is still the one the source version linked.
        val running = CaseDefinitionId("verhuizing", "1.0.1")
        val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")
        val askedAbout = mutableMapOf<String, BlueprintId>()
        val service = suggestionService(
            dataMigration = listOf(mapOf("source" to "doc:/adres", "target" to "doc:/adres")),
            processMigration = listOf(mapOf("sourceProcessDefinitionKey" to "inspectie")),
            onEntrySuggestion = { componentKey, asked -> askedAbout[componentKey] = asked },
        )

        service.suggestBuildingBlockEntry(target, nested, running)

        assertThat(askedAbout["dataMigration"]).isEqualTo(target)
        assertThat(askedAbout["processMigration"]).isEqualTo(running)
    }

    @Test
    fun `an entry asked about one version only keeps asking about that one`() {
        // The remove direction and every caller that has nothing better to say: the block's own processes are the ones it hands back.
        val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")
        val askedAbout = mutableMapOf<String, BlueprintId>()
        val service = suggestionService(
            processMigration = listOf(mapOf("sourceProcessDefinitionKey" to "inspectie")),
            onEntrySuggestion = { componentKey, asked -> askedAbout[componentKey] = asked },
        )

        service.suggestBuildingBlockEntry(nested, target)

        assertThat(askedAbout["processMigration"]).isEqualTo(nested)
    }

    @Test
    fun `the running owner of a blueprint migrating itself is the version the plan migrates from`() {
        val source = CaseDefinitionId("verhuizing", "1.0.1")
        val service = suggestionService(entryOwners = emptyMap())

        assertThat(service.runningOwnerOf(owner = target, migrating = target, source = source)).isEqualTo(source)
    }

    @Test
    fun `a plan declaring no source leaves the owner as it was read`() {
        val service = suggestionService(entryOwners = emptyMap())

        assertThat(service.runningOwnerOf(owner = target, migrating = target, source = null)).isEqualTo(target)
    }

    @Test
    fun `a nested owner is read back at the version the source tree declares`() {
        val onTarget = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
        val onSource = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.3")
        val service = suggestionService(
            entryOwners = emptyMap(),
            entryOwnersInSourceTree = mapOf(onTarget to onSource),
        )

        val running = service.runningOwnerOf(
            owner = onTarget,
            migrating = target,
            source = CaseDefinitionId("verhuizing", "1.0.1"),
        )

        assertThat(running).isEqualTo(onSource)
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
        // The shape of every version not drafted in the admin UI: no `basedOnVersionTag`, so without the fallback the plan came back as a skeleton with no source.
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
        // The customer configuration: 1.0.0 alongside the 0.1.0-migrated. As text `1.0.0-migrated` sorts after `1.0.0`.
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
        // Checked here rather than at file import: on this path every definition is deployed, and a source that is not selects nothing.
        val service = suggestionService(lineage = lineage(exists = false))
        val plan = objectMapper.readTree("""{"key": "x", "source": {"versionTag": "1.0.1"}}""")

        val problems = service.findPlanProblems(target, plan)

        assertThat(problems).singleElement().asString().contains("is not deployed")
    }

    @Test
    fun `components are validated against the source the plan declares, key included`() {
        // The source is read off the plan, so a cross-key plan validates against the other case definition.
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
        // Seen in the field: a `$ref` to an absent file threw out of the dataMigration suggester and GET /suggestion answered 500, so the editor got no plan at all.
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
        // The skeleton still arrives, so the author can open the plan and fill the rest in.
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.1")
        assertThat(plan.get("migrationTriggers").get("triggeredByButton").asBoolean()).isTrue()
    }

    @Test
    fun `a nested entry's owner is the block that declares it, not the blueprint being migrated`() {
        val case = CaseDefinitionId("woninginspectie", "1.0.4")
        val parent = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.5")
        val nested = BuildingBlockDefinitionId("inspectie-dossier", "1.0.0")
        val service = suggestionService(entryOwners = mapOf(nested to parent))

        assertThat(service.entryOwnerOf(case, nested)).isEqualTo(parent)
        assertThat(service.describeEntryOwner(parent).get("type").asText()).isEqualTo("BUILDING_BLOCK")
        assertThat(service.describeEntryOwner(parent).get("key").asText()).isEqualTo("verhuizing-inspectie")
        assertThat(service.describeEntryOwner(parent).get("versionTag").asText()).isEqualTo("1.0.5")
    }

    @Test
    fun `an entry's owner is the migrating blueprint when nothing above the block declares it`() {
        // Also the answer for a deployment with no building blocks, where nothing implements the contract.
        val case = CaseDefinitionId("woninginspectie", "1.0.4")
        val block = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.5")

        assertThat(suggestionService().entryOwnerOf(case, block)).isEqualTo(case)
        assertThat(suggestionService(entryOwners = emptyMap()).entryOwnerOf(case, block)).isEqualTo(case)
    }

    @Test
    fun `every suggester shares one answer to the same question about the same blueprints`() {
        // The suggesters re-ask the same tree and schema walks per component and per entry. Without an open scope the cache is transparent: 45 seconds on a suggestion holding 53 entries.
        val computed = mutableListOf<BlueprintId>()
        val service = MigrationSuggestionService(
            objectMapper = objectMapper,
            versionLineages = emptyList(),
            componentSuggesters = listOf(
                memoizingSuggester("dataMigration", computed),
                memoizingSuggester("processMigration", computed),
            ),
            activityMappingSuggesters = emptyList(),
            activityMappingValidators = emptyList(),
            componentValidators = emptyList(),
        )

        service.suggestPlan(target = target, source = CaseDefinitionId("verhuizing", "1.0.1"))

        // Four asks — two suggesters, each about both blueprints — answered by two computations.
        assertThat(computed).containsExactly(CaseDefinitionId("verhuizing", "1.0.1"), target)
    }

    @Test
    fun `a building block entry suggestion shares its answers too`() {
        val computed = mutableListOf<BlueprintId>()
        val service = MigrationSuggestionService(
            objectMapper = objectMapper,
            versionLineages = emptyList(),
            componentSuggesters = listOf(
                memoizingSuggester("dataMigration", computed),
                memoizingSuggester("processMigration", computed),
            ),
            activityMappingSuggesters = emptyList(),
            activityMappingValidators = emptyList(),
            componentValidators = emptyList(),
        )
        val owner = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
        val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")

        service.suggestBuildingBlockEntry(owner, nested)

        assertThat(computed).containsExactly(owner, nested)
    }

    @Test
    fun `plan validation shares its answers across validators`() {
        val computed = mutableListOf<BlueprintId>()
        val service = MigrationSuggestionService(
            objectMapper = objectMapper,
            versionLineages = listOf(lineage(exists = true)),
            componentSuggesters = emptyList(),
            activityMappingSuggesters = emptyList(),
            activityMappingValidators = emptyList(),
            componentValidators = listOf(
                memoizingValidator("dataMigration", computed),
                memoizingValidator("processMigration", computed),
            ),
        )
        val plan = objectMapper.readTree(
            """{"key": "x", "source": {"versionTag": "1.0.1"}, "dataMigration": [], "processMigration": []}"""
        )

        service.findPlanProblems(target, plan)

        assertThat(computed).containsExactly(CaseDefinitionId("verhuizing", "1.0.1"), target)
    }

    /** Records, in [computed], every blueprint the run cache actually had to work out an answer for. */
    private fun memoize(blueprintId: BlueprintId, computed: MutableList<BlueprintId>): String =
        MigrationRunCache.computeIfAbsent(blueprintId to "walk") {
            computed += blueprintId
            blueprintId.toString()
        }

    private fun memoizingSuggester(componentKey: String, computed: MutableList<BlueprintId>) =
        object : MigrationComponentSuggester {
            override fun componentKey() = componentKey
            override fun suggest(source: BlueprintId, target: BlueprintId): Any =
                listOf(memoize(source, computed), memoize(target, computed))

            override fun suggestForBuildingBlockEntry(
                source: BlueprintId,
                target: BlueprintId,
                running: BlueprintId,
            ): Any = suggest(running, target)
        }

    private fun memoizingValidator(componentKey: String, computed: MutableList<BlueprintId>) =
        object : MigrationComponentValidator {
            override fun componentKey() = componentKey
            override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
                memoize(source, computed)
                memoize(target, computed)
                return emptyList()
            }
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
        addBuildingBlock: Any? = null,
        lineage: BlueprintVersionLineage? = null,
        componentValidator: MigrationComponentValidator? = null,
        entryOwners: Map<BuildingBlockDefinitionId, BlueprintId>? = null,
        entryOwnersInSourceTree: Map<BlueprintId, BlueprintId> = emptyMap(),
        onEntrySuggestion: (String, BlueprintId) -> Unit = { _, _ -> },
    ) = MigrationSuggestionService(
        objectMapper = objectMapper,
        versionLineages = listOfNotNull(lineage),
        componentSuggesters = listOfNotNull(
            dataMigration?.let { suggester("dataMigration", it, onEntrySuggestion) },
            processMigration?.let { suggester("processMigration", it, onEntrySuggestion) },
            addBuildingBlock?.let { suggester("addBuildingBlock", it, onEntrySuggestion) },
        ),
        activityMappingSuggesters = emptyList(),
        activityMappingValidators = emptyList(),
        componentValidators = listOfNotNull(componentValidator),
        buildingBlockEntryOwnerships = entryOwners
            ?.let { listOf(entryOwnership(it, entryOwnersInSourceTree)) }
            ?: emptyList(),
    )

    private fun entryOwnership(
        owners: Map<BuildingBlockDefinitionId, BlueprintId>,
        declaredIn: Map<BlueprintId, BlueprintId> = emptyMap(),
    ) = object : BuildingBlockEntryOwnership {
        override fun supports(blueprintType: BlueprintType) = true
        override fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId) =
            owners[block] ?: migratingOwner

        override fun ownerAsDeclaredIn(tree: BlueprintId, owner: BlueprintId) = declaredIn[owner] ?: owner
    }

    /** Records the blueprint each component was asked to suggest an entry against — [MigrationComponentSuggester.suggestForBuildingBlockEntry]'s `running`. */
    private fun suggester(
        componentKey: String,
        suggestion: Any,
        onEntry: (String, BlueprintId) -> Unit = { _, _ -> },
    ) = object : MigrationComponentSuggester {
        override fun componentKey() = componentKey
        override fun suggest(source: BlueprintId, target: BlueprintId) = suggestion
        override fun suggestForBuildingBlockEntry(
            source: BlueprintId,
            target: BlueprintId,
            running: BlueprintId,
        ): Any {
            onEntry(componentKey, running)
            return suggestion
        }
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
