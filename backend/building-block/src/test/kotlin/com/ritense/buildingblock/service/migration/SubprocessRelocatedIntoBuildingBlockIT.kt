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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationSuggestionService
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.TaskService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID

/** A version moving its own sub-process into a building block (G79): the link tells adoption *which* process becomes the block, but not that the block renamed `task1` to `task_1`, and a token sitting there is what needs it said. */
class SubprocessRelocatedIntoBuildingBlockIT @Autowired constructor(
    private val migrationSuggestionService: MigrationSuggestionService,
    private val migrationPlanImporter: MigrationPlanImporter,
    private val caseMigrationService: CaseMigrationService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentService: DocumentService,
    private val runtimeService: RuntimeService,
    private val repositoryService: RepositoryService,
    private val taskService: TaskService,
    private val transactionTemplate: TransactionTemplate,
) : BaseIntegrationTest() {

    /** Puts back what a sibling test took: several ITs here `deleteAll()` the document-definition and building-block tables, so a `config/` fixture outlives only the first of them. Operaton's own tables are never touched, so the deployments stand and only the rows pointing at them need re-asserting. */
    @BeforeEach
    fun restoreFixtureRows() {
        listOf(V1 to "1-0-0", V2 to "2-0-0").forEach { (version, folder) ->
            documentDefinitionRepository.saveIfAbsent(
                JsonSchemaDocumentDefinitionId.forCase(CASE_KEY, version),
                "/config/case/$CASE_KEY/$folder/document/definition/$CASE_KEY.schema.document-definition.json",
            )
        }
        documentDefinitionRepository.saveIfAbsent(
            JsonSchemaDocumentDefinitionId.forBuildingBlock(BLOCK.key, BLOCK),
            "/config/building-block/${BLOCK.key}/1-0-0/document/definition/${BLOCK.key}.schema.document-definition.json",
        )
        if (buildingBlockDefinitionRepository.findById(BLOCK).isEmpty) {
            buildingBlockDefinitionRepository.saveAndFlush(
                BuildingBlockDefinition(
                    id = BLOCK,
                    name = BLOCK.key,
                    createdBy = "tester",
                    createdDate = LocalDateTime.now(),
                    basedOnVersionTag = null,
                )
            )
        }
        val blockProcessDefinitionId = ProcessDefinitionId.of(processDefinitionId(SUB_PROCESS, BLOCK_TAG))
        val link = ProcessDefinitionBuildingBlockDefinitionId(blockProcessDefinitionId, BLOCK)
        if (processDefinitionBuildingBlockDefinitionRepository.findById(link).isEmpty) {
            processDefinitionBuildingBlockDefinitionRepository.saveAndFlush(
                ProcessDefinitionBuildingBlockDefinition(link, main = true)
            )
        }
    }

    /** The other side of [restoreFixtureRows]: siblings assert over whole tables, so a case left running here breaks them from a distance. */
    @AfterEach
    fun removeWhatThisTestLeftBehind() {
        runWithoutAuthorization {
            listOf(MAIN_PROCESS, SUB_PROCESS).forEach { processDefinitionKey ->
                runtimeService.createProcessInstanceQuery()
                    .processDefinitionKey(processDefinitionKey)
                    .list()
                    // Already gone with its parent, most of the time — the query answered before the cascade.
                    .forEach { instance ->
                        runCatching {
                            runtimeService.deleteProcessInstance(
                                instance.processInstanceId, "fixture cleanup", true, true, true, false
                            )
                        }
                    }
            }
            buildingBlockInstanceRepository.deleteAll(
                buildingBlockInstanceRepository.findAll().filter { it.definition.id == BLOCK }
            )
            caseMigrationService.deletePlan(PLAN_ID)
        }
    }

    /** Re-read from the fixture's own file, so the restored definition cannot drift from the deployed one. */
    private fun JsonSchemaDocumentDefinitionRepository.saveIfAbsent(
        id: JsonSchemaDocumentDefinitionId,
        schemaResource: String,
    ) {
        if (findById(id).isEmpty) {
            val schema = checkNotNull(javaClass.getResource(schemaResource)) { "No $schemaResource" }.readText()
            saveAndFlush(JsonSchemaDocumentDefinition(id, JsonSchema.fromString(schema)))
        }
    }

    @Test
    fun `the suggested entry carries the relocated process and the activity the block renamed`() {
        val plan = migrationSuggestionService.suggestPlan(V2, V1)

        // The owner's own process is migrated by the plan's top-level component, as always.
        assertThat(pairsOf(plan.get("processMigration")))
            .containsExactly(MAIN_PROCESS to MAIN_PROCESS)

        val entry = plan.get("addBuildingBlock").single()
        assertThat(entry.get("buildingBlockKey").asText()).isEqualTo(BLOCK.key)

        val row = entry.get("processMigration").single()
        assertThat(row.get("sourceProcessDefinitionKey").asText()).isEqualTo(SUB_PROCESS)
        assertThat(row.get("targetProcessDefinitionKey").asText()).isEqualTo(SUB_PROCESS)
        assertThat(row.get("mapActivities").get("task1").asText()).isEqualTo("task_1")
    }

    @Test
    fun `a case whose token is in the renamed activity is adopted onto the block and keeps its task`() {
        val caseDocumentId = startCaseOnVersionOne()
        assertThat(taskKeyOf(caseDocumentId)).isEqualTo("task1")

        deploy(migrationSuggestionService.suggestPlan(V2, V1))
        caseMigrationService.startMigration(PLAN_ID)

        val status = caseMigrationService.getStatus(PLAN_ID)
        assertThat(status.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(status.errors).isEmpty()

        // The running sub-process became the block, and the token moved with it.
        val instance = transactionTemplate.execute {
            buildingBlockInstanceRepository.findAll().single { it.caseDocumentId == caseDocumentId }
        }!!
        assertThat(instance.definition.id).isEqualTo(BLOCK)
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.activityId).isEqualTo(CALL_ACTIVITY)
        assertThat(taskKeyOf(instance.documentId)).isEqualTo("task_1")
        assertThat(processDefinitionIdOf(instance.processInstanceId!!))
            .isEqualTo(processDefinitionId(SUB_PROCESS, BLOCK_TAG))
    }

    @Test
    fun `an entry stripped of its row says which activity it could not map before the engine does`() {
        // What such a plan looked like before the row: `mapEqualActivities()` alone, silent about `task1`.
        val caseDocumentId = startCaseOnVersionOne()
        assertThat(taskKeyOf(caseDocumentId)).isEqualTo("task1")
        deploy(withoutEntryProcessMigration(migrationSuggestionService.suggestPlan(V2, V1)))

        caseMigrationService.startMigration(PLAN_ID)

        val status = caseMigrationService.getStatus(PLAN_ID)
        assertThat(status.warnings.filter { it.caseId == caseDocumentId.toString() })
            .describedAs("errors=${status.errors.map { it.caseId to it.message }}")
            .anySatisfy { warning ->
                assertThat(warning.message)
                    .contains("'task1', where this case has a token, with no counterpart")
                    .contains("carries no 'processMigration' row")
            }
        // And then the engine refuses, as it always did — the case rolls back with its token where it was.
        assertThat(status.errors.filter { it.caseId == caseDocumentId.toString() }).isNotEmpty()
        assertThat(taskKeyOf(caseDocumentId)).isEqualTo("task1")
    }

    private fun startCaseOnVersionOne(): UUID {
        val caseDocumentId = runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    CASE_KEY,
                    V1.key,
                    V1.versionTag.toString(),
                    JsonNodeFactory.instance.objectNode().put("onderwerp", "voor de migratie"),
                )
            ).resultingDocument().orElseThrow().id().id
        }
        runWithoutAuthorization {
            runtimeService.startProcessInstanceById(
                processDefinitionId(MAIN_PROCESS, CASE_TAG),
                caseDocumentId.toString(),
            )
        }
        return caseDocumentId
    }

    /** The suggestion as the editor would save it: everything it filled in, plus the key the author names. */
    private fun deploy(plan: ObjectNode) {
        migrationPlanImporter.deploy(V2, plan.put("key", PLAN_KEY))
    }

    private fun withoutEntryProcessMigration(plan: ObjectNode): ObjectNode = plan.also {
        (it.get("addBuildingBlock").single() as ObjectNode).putArray("processMigration")
    }

    private fun pairsOf(component: JsonNode?): List<Pair<String, String?>> = component.orEmpty().map { row ->
        row.get("sourceProcessDefinitionKey").asText() to
            row.get("targetProcessDefinitionKey")?.takeIf { it.isTextual }?.asText()
    }

    private fun JsonNode?.orEmpty(): List<JsonNode> = this?.toList() ?: emptyList()

    /** The one deployment of [processDefinitionKey] carrying [versionTag] — the fixture deploys the key twice. */
    private fun processDefinitionId(processDefinitionKey: String, versionTag: String): String =
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processDefinitionKey)
            .versionTag(versionTag)
            .singleResult()
            .id

    private fun processDefinitionIdOf(processInstanceId: String): String =
        runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            .processDefinitionId

    /** The task definition key of the one task running under [businessKey], whoever owns the process by now. */
    private fun taskKeyOf(businessKey: UUID): String =
        taskService.createTaskQuery().processInstanceBusinessKey(businessKey.toString()).list()
            .single()
            .taskDefinitionKey

    private companion object {
        const val CASE_KEY = "subproces-naar-bouwsteen"
        const val MAIN_PROCESS = "snb-hoofdproces"
        const val SUB_PROCESS = "snb-behandeling"
        const val CALL_ACTIVITY = "CallBehandeling"
        const val PLAN_KEY = "snb-naar-bouwsteen"

        val V1 = CaseDefinitionId.of(CASE_KEY, "1.0.0")
        val V2 = CaseDefinitionId.of(CASE_KEY, "2.0.0")
        val BLOCK = BuildingBlockDefinitionId.of("snb-behandeling-bouwsteen", "1.0.0")
        val PLAN_ID = BlueprintMigrationId.from(V2, PLAN_KEY)

        /** The version tags the deployer stamps on the two `snb-behandeling` deployments. */
        const val BLOCK_TAG = "BB:snb-behandeling-bouwsteen:1.0.0"
        const val CASE_TAG = "CD:$CASE_KEY:1.0.0"
    }
}
