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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.CaseMigrationCaseStatus
import com.ritense.case_.domain.migration.CaseMigrationStatus
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationExecutionRepository
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.case_.repository.CaseMigrationCaseRepository
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationTriggerScheduler
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID

/** Whole-engine coverage of building block migration as a consequence of case migration: recursion (R4), atomicity (R5), G49, dry run, no independent trigger (R1) and nesting. Fixtures carry no running process. */
class BuildingBlockMigrationCascadeIT @Autowired constructor(
    private val caseMigrationService: CaseMigrationService,
    private val migrationTriggerScheduler: MigrationTriggerScheduler,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val executionRepository: CaseDefinitionMigrationExecutionRepository,
    private val caseMigrationCaseRepository: CaseMigrationCaseRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentRepository: JsonSchemaDocumentRepository,
    private val documentService: DocumentService,
    private val migrationPlanImporter: MigrationPlanImporter,
    private val objectMapper: ObjectMapper,
    private val transactionTemplate: TransactionTemplate,
) : BaseIntegrationTest() {

    @Test
    fun `a case migration cascades into its building block and that block's nested block`() {
        val fixture = createCascadeFixture()

        caseMigrationService.startMigration(fixture.casePlanId)

        assertThat(caseMigrationService.getStatus(fixture.casePlanId).status)
            .isEqualTo(CaseMigrationStatus.COMPLETED)

        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.innerDocumentId)).isEqualTo(V2)

        // Instances re-pointed too: a block still claiming its old definition would be re-selected next time.
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV2)
        assertThat(definitionIdOf(fixture.innerDocumentId)).isEqualTo(fixture.innerV2)

        assertThat(migratedCount(fixture.outerPlanId)).isEqualTo(1)
        assertThat(migratedCount(fixture.innerPlanId)).isEqualTo(1)
        assertThat(caseMigrationService.getStatus(fixture.outerPlanId).casesMigrated).isEqualTo(1)
        assertThat(caseMigrationService.getStatus(fixture.innerPlanId).casesMigrated).isEqualTo(1)
    }

    @Test
    fun `a failing building block step rolls back the whole case migration`() {
        // Two chains reach the version the owner links, so alignment refuses rather than improvising (R3).
        val fixture = createCascadeFixture()
        deployPlan(BlueprintMigrationId.from(fixture.innerV2, "cascade-inner-shortcut"))

        caseMigrationService.startMigration(fixture.casePlanId)

        // Reported against the case plan — the case did not migrate.
        val status = caseMigrationService.getStatus(fixture.casePlanId)
        assertThat(status.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
        assertThat(status.casesMigrated).isZero()
        assertThat(status.errors).hasSize(1)
        val failure = status.errors.single()
        assertThat(failure.caseId).isEqualTo(fixture.caseDocumentId.toString())
        assertThat(failure.message)
            .contains("more than one chain of migration plans")
            .contains("${fixture.innerKey}:$V2")

        // Not even the outer block the cascade had already migrated before it reached the failure.
        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.innerDocumentId)).isEqualTo(V1)
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV1)
        assertThat(definitionIdOf(fixture.innerDocumentId)).isEqualTo(fixture.innerV1)
        assertThat(migratedCount(fixture.outerPlanId)).isZero()
    }

    /** G49: no plan connects the inner block's version to the one its owner now links, and nothing runs under it. */
    @Test
    fun `a case migration leaves a block with no running process behind rather than failing over a missing plan`() {
        val fixture = createCascadeFixture(deployInnerPlan = false)

        caseMigrationService.startMigration(fixture.casePlanId)

        val status = caseMigrationService.getStatus(fixture.casePlanId)
        assertThat(status.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(status.casesMigrated).isEqualTo(1)
        assertThat(status.errors).isEmpty()

        // The rest of the work stands — that is the point of not failing.
        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.innerDocumentId)).isEqualTo(V1)
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV2)
        assertThat(definitionIdOf(fixture.innerDocumentId)).isEqualTo(fixture.innerV1)
        assertThat(migratedCount(fixture.outerPlanId)).isEqualTo(1)
        assertThat(migratedCount(fixture.innerPlanId)).isZero()

        // And it is not silent: the case now differs from one started on the target version.
        val warning = status.warnings.single()
        assertThat(warning.caseId).isEqualTo(fixture.caseDocumentId.toString())
        assertThat(warning.message)
            .contains("is not running a process")
            .contains("no migration plan connects it to '${fixture.innerV2}'")
    }

    @Test
    fun `a dry run of a cascading case migration persists nothing`() {
        val fixture = createCascadeFixture()

        val dryRun = caseMigrationService.startDryRun(fixture.casePlanId)

        assertThat(dryRun.status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(dryRun.casesChecked).isEqualTo(1)
        assertThat(dryRun.casesWouldMigrate).isEqualTo(1)
        assertThat(dryRun.casesWouldFail).isZero()

        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.innerDocumentId)).isEqualTo(V1)
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV1)
        assertThat(definitionIdOf(fixture.innerDocumentId)).isEqualTo(fixture.innerV1)

        // In particular no MIGRATED rows, which a later real run would read as "already done".
        assertThat(migratedCount(fixture.casePlanId)).isZero()
        assertThat(migratedCount(fixture.outerPlanId)).isZero()
        assertThat(migratedCount(fixture.innerPlanId)).isZero()
    }

    @Test
    fun `a real run after a dry run still migrates the case and its building blocks`() {
        val fixture = createCascadeFixture()

        assertThat(caseMigrationService.startDryRun(fixture.casePlanId).casesWouldMigrate).isEqualTo(1)
        caseMigrationService.startMigration(fixture.casePlanId)

        assertThat(caseMigrationService.getStatus(fixture.casePlanId).casesMigrated).isEqualTo(1)
        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V2)
        assertThat(documentVersionOf(fixture.innerDocumentId)).isEqualTo(V2)
    }

    @Test
    fun `a dry run reports a broken building block chain as WOULD_FAIL`() {
        val fixture = createCascadeFixture()
        deployPlan(BlueprintMigrationId.from(fixture.innerV2, "cascade-inner-shortcut"))

        val dryRun = caseMigrationService.startDryRun(fixture.casePlanId)

        assertThat(dryRun.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
        assertThat(dryRun.casesChecked).isEqualTo(1)
        assertThat(dryRun.casesWouldMigrate).isZero()
        assertThat(dryRun.casesWouldFail).isEqualTo(1)
        assertThat(dryRun.errors).hasSize(1)
        val failure = dryRun.errors.single()
        assertThat(failure.caseId).isEqualTo(fixture.caseDocumentId.toString())
        assertThat(failure.message)
            .contains("more than one chain of migration plans")
            .contains("${fixture.innerKey}:$V2")

        // A dry run that found a problem still persists nothing.
        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V1)
        assertThat(migratedCount(fixture.casePlanId)).isZero()
        assertThat(migratedCount(fixture.outerPlanId)).isZero()
    }

    @Test
    fun `a case migration moves a nested block onto a different building block key`() {
        // The outer block's new version points the same call activity at a different key; only the plan connects them.
        val fixture = createCascadeFixture(innerTargetKeySuffix = "replacement")

        caseMigrationService.startMigration(fixture.casePlanId)

        assertThat(caseMigrationService.getStatus(fixture.casePlanId).status)
            .isEqualTo(CaseMigrationStatus.COMPLETED)

        val replacement = fixture.innerV2
        assertThat(definitionIdOf(fixture.innerDocumentId)).isEqualTo(replacement)
        assertThat(documentBlueprintOf(fixture.innerDocumentId)).isEqualTo("${replacement.key}:${replacement.versionTag}")
        assertThat(migratedCount(fixture.innerPlanId)).isEqualTo(1)

        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V2)
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV2)
    }

    @Test
    fun `a second chain of plans to the same version fails the case rather than picking one`() {
        val fixture = createCascadeFixture()

        // A shortcut plan alongside the existing one: both lead the inner block from V1 to V2.
        deployPlan(BlueprintMigrationId.from(fixture.innerV2, "cascade-inner-shortcut"))

        caseMigrationService.startMigration(fixture.casePlanId)

        val status = caseMigrationService.getStatus(fixture.casePlanId)
        assertThat(status.status).isEqualTo(CaseMigrationStatus.COMPLETED_WITH_ERRORS)
        assertThat(status.casesMigrated).isZero()
        assertThat(status.errors.single().message)
            .contains("more than one chain of migration plans")
            .contains("cascade-inner-plan")
            .contains("cascade-inner-shortcut")

        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V1)
        assertThat(documentVersionOf(fixture.outerDocumentId)).isEqualTo(V1)
        assertThat(migratedCount(fixture.outerPlanId)).isZero()
    }

    @Test
    fun `a building block plan removes a building block nested inside the migrating block`() {
        val fixture = createCascadeFixture(innerValue = NESTED_VALUE)
        deployRemoveNestedBlockPlan(fixture)

        caseMigrationService.startMigration(fixture.casePlanId)

        assertThat(caseMigrationService.getStatus(fixture.casePlanId).status)
            .isEqualTo(CaseMigrationStatus.COMPLETED)

        assertThat(instanceOf(fixture.innerDocumentId)).isNull()
        assertThat(documentExists(fixture.innerDocumentId)).isFalse()
        assertThat(documentValueOf(fixture.outerDocumentId)).isEqualTo(NESTED_VALUE)

        // Alignment (@500) runs after removal (@400), so there is nothing left to align by the time it looks.
        assertThat(documentVersionOf(fixture.caseDocumentId)).isEqualTo(V2)
        assertThat(definitionIdOf(fixture.outerDocumentId)).isEqualTo(fixture.outerV2)
        assertThat(migratedCount(fixture.outerPlanId)).isEqualTo(1)
        assertThat(migratedCount(fixture.innerPlanId)).isZero()
    }

    @Test
    fun `the trigger sweep starts case plans but never a building block plan`() {
        val uid = uniqueSuffix()
        val dueAt = LocalDateTime.now().minusHours(1)

        // A case plan that is due: proof that the sweep is doing its job at all.
        val caseKey = "sweep-case-$uid"
        val caseV1 = CaseDefinitionId.of(caseKey, V1)
        val caseV2 = CaseDefinitionId.of(caseKey, V2)
        deployCaseDefinitions(caseKey, caseV1, caseV2)
        val caseDocumentId = createCaseDocument(caseKey, caseV1)
        val casePlanId = deployPlan(BlueprintMigrationId.from(caseV2, "sweep-case-plan"), dueAt)

        // A due building block plan under a case that is not migrating; written straight to the repository because the importer refuses triggers on one.
        val bbKey = "sweep-bb-$uid"
        val bbV1 = BuildingBlockDefinitionId.of(bbKey, V1)
        val bbV2 = BuildingBlockDefinitionId.of(bbKey, V2)
        deployBuildingBlockDefinitions(bbKey, bbV1, bbV2)
        val bbDocumentId = createBuildingBlockDocument(bbKey, bbV1)
        buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = bbDocumentId,
                caseDocumentId = createCaseDocument(caseKey, caseV2), // a case that has nothing to migrate to
                definition = definitionOf(bbV1),
            )
        )
        val bbPlanId = deployPlan(BlueprintMigrationId.from(bbV2, "sweep-bb-plan"), dueAt)

        migrationTriggerScheduler.checkTriggers()

        assertThat(executionRepository.findById(casePlanId)).isPresent
        assertThat(caseMigrationService.getStatus(casePlanId).status).isEqualTo(CaseMigrationStatus.COMPLETED)
        assertThat(documentVersionOf(caseDocumentId)).isEqualTo(V2)

        // No run was ever claimed for the building block plan.
        assertThat(executionRepository.findById(bbPlanId)).isEmpty
        assertThat(migratedCount(bbPlanId)).isZero()
        assertThat(documentVersionOf(bbDocumentId)).isEqualTo(V1)
        assertThat(definitionIdOf(bbDocumentId)).isEqualTo(bbV1)
    }

    /** case 1.0.0 -(startable item)-> outer 1.0.0 -(call activity)-> inner 1.0.0, with the 1.0.1 chain to migrate onto. [innerTargetKeySuffix] makes the inner destination a different key. */
    private fun createCascadeFixture(
        deployInnerPlan: Boolean = true,
        innerTargetKeySuffix: String? = null,
        innerValue: String = "before-migration",
    ): Fixture {
        val uid = uniqueSuffix()

        val caseKey = "cascade-case-$uid"
        val caseV1 = CaseDefinitionId.of(caseKey, V1)
        val caseV2 = CaseDefinitionId.of(caseKey, V2)
        deployCaseDefinitions(caseKey, caseV1, caseV2)

        val outerKey = "cascade-outer-$uid"
        val outerV1 = BuildingBlockDefinitionId.of(outerKey, V1)
        val outerV2 = BuildingBlockDefinitionId.of(outerKey, V2)
        deployBuildingBlockDefinitions(outerKey, outerV1, outerV2)

        val innerKey = "cascade-inner-$uid"
        val innerV1 = BuildingBlockDefinitionId.of(innerKey, V1)
        val innerV2 = if (innerTargetKeySuffix == null) {
            BuildingBlockDefinitionId.of(innerKey, V2)
        } else {
            // No basedOnVersionTag, so only a plan can carry an instance across.
            BuildingBlockDefinitionId.of("cascade-$innerTargetKeySuffix-$uid", V1)
        }
        deployBuildingBlockDefinitions(innerKey, innerV1, BuildingBlockDefinitionId.of(innerKey, V2))
        if (innerTargetKeySuffix != null) {
            deployBuildingBlockDefinition(innerV2, basedOnVersionTag = null)
        }

        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(caseDefinitionId = caseV2, buildingBlockDefinitionId = outerV2)
        )
        // Same activity id, so the instance still matches its own link.
        linkAsCallActivity(owner = outerV2, activityId = NESTED_ACTIVITY_ID, target = innerV2)

        val caseDocumentId = createCaseDocument(caseKey, caseV1)

        val outerDocumentId = createBuildingBlockDocument(outerKey, outerV1)
        val outerInstance = buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = outerDocumentId,
                caseDocumentId = caseDocumentId,
                // No activityId: this block was started from the case's startable item.
                definition = definitionOf(outerV1),
            )
        )

        val innerDocumentId = createBuildingBlockDocument(innerKey, innerV1, innerValue)
        buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = innerDocumentId,
                caseDocumentId = caseDocumentId,
                activityId = NESTED_ACTIVITY_ID,
                parentBuildingBlockInstanceId = outerInstance.id,
                definition = definitionOf(innerV1),
            )
        )

        val casePlanId = deployPlan(BlueprintMigrationId.from(caseV2, "cascade-case-plan"))
        val outerPlanId = deployPlan(BlueprintMigrationId.from(outerV2, "cascade-outer-plan"))
        val innerPlanId = BlueprintMigrationId.from(innerV2, "cascade-inner-plan")
        if (deployInnerPlan) {
            // The plan's source is where the instance actually is — the other key when it is being replaced.
            deployPlan(innerPlanId, sourceKey = innerKey, sourceVersionTag = V1)
        }

        return Fixture(
            casePlanId = casePlanId,
            caseDocumentId = caseDocumentId,
            outerV1 = outerV1,
            outerV2 = outerV2,
            outerPlanId = outerPlanId,
            outerDocumentId = outerDocumentId,
            innerKey = innerKey,
            innerV1 = innerV1,
            innerV2 = innerV2,
            innerPlanId = innerPlanId,
            innerDocumentId = innerDocumentId,
        )
    }

    private fun deployCaseDefinitions(key: String, v1: CaseDefinitionId, v2: CaseDefinitionId) {
        caseDefinitionRepository.save(
            CaseDefinition(id = v1, name = key, createdDate = LocalDateTime.now(), basedOnVersionTag = null)
        )
        caseDefinitionRepository.save(
            CaseDefinition(id = v2, name = key, createdDate = LocalDateTime.now(), basedOnVersionTag = v1.versionTag)
        )
        listOf(v1, v2).forEach { caseDefinitionId ->
            documentDefinitionRepository.saveAndFlush(
                JsonSchemaDocumentDefinition(
                    JsonSchemaDocumentDefinitionId.forCase(key, caseDefinitionId),
                    JsonSchema.fromString(schemaFor(key))
                )
            )
        }
    }

    private fun deployBuildingBlockDefinitions(
        key: String,
        v1: BuildingBlockDefinitionId,
        v2: BuildingBlockDefinitionId,
    ) {
        deployBuildingBlockDefinition(v1, basedOnVersionTag = null)
        deployBuildingBlockDefinition(v2, basedOnVersionTag = v1.versionTag)
    }

    /** Each version's document definition is named after the block's own key, so re-homing across keys must look the name up. */
    private fun deployBuildingBlockDefinition(id: BuildingBlockDefinitionId, basedOnVersionTag: Semver?) {
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(
                id = id,
                name = id.key,
                createdBy = "tester",
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = basedOnVersionTag,
            )
        )
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forBuildingBlock(id.key, id),
                JsonSchema.fromString(schemaFor(id.key))
            )
        )
    }

    /** Gives [owner] a process definition whose [activityId] call activity starts [target]. Nothing is deployed under that id on purpose — every read of it has to answer rather than throw. */
    private fun linkAsCallActivity(owner: BuildingBlockDefinitionId, activityId: String, target: BuildingBlockDefinitionId) {
        // Shaped like an Operaton process definition id, but kept short: the column is varchar(64).
        val processDefinitionId = "proc-${uniqueSuffix()}:1:${uniqueSuffix()}"
        processDefinitionBuildingBlockDefinitionRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(ProcessDefinitionId.of(processDefinitionId), owner),
                main = true,
            )
        )
        processLinkRepository.saveAndFlush(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = activityId,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = target,
                pluginConfigurationMappings = emptyMap(),
            )
        )
    }

    /** Deploy a plan on [id]'s blueprint version, migrating instances from [sourceKey]:[sourceVersionTag]. */
    private fun deployPlan(
        id: BlueprintMigrationId,
        scheduledAtDate: LocalDateTime? = null,
        sourceKey: String = id.key,
        sourceVersionTag: String = V1,
    ): BlueprintMigrationId {
        caseDefinitionMigrationRepository.saveAndFlush(
            CaseDefinitionMigration(
                id = id,
                sourceKey = sourceKey,
                sourceVersionTag = Semver(sourceVersionTag),
                title = id.migrationKey,
                migrationTriggers = MigrationTriggers(scheduledAtDate = scheduledAtDate),
            )
        )
        return id
    }

    /** Re-deploy the outer block's plan through the importer, dissolving the nested block. Only `removeBuildingBlock` can be shown here — these fixtures carry no running process. */
    private fun deployRemoveNestedBlockPlan(fixture: Fixture) {
        val plan = objectMapper.readTree(
            """
            {
              "key": "${fixture.outerPlanId.migrationKey}",
              "source": {"key": "${fixture.outerV1.key}", "versionTag": "$V1"},
              "removeBuildingBlock": [
                {
                  "buildingBlockKey": "${fixture.innerKey}",
                  "buildingBlockVersionTag": "$V1",
                  "dataMigration": [{"target": "doc:/value", "source": "doc:/value"}],
                  "processMigration": []
                }
              ]
            }
            """.trimIndent()
        )
        migrationPlanImporter.deploy(fixture.outerV2, plan)
    }

    private fun createCaseDocument(documentDefinitionName: String, caseDefinitionId: CaseDefinitionId): UUID {
        return createDocument(
            NewDocumentRequest(
                documentDefinitionName,
                caseDefinitionId.key,
                caseDefinitionId.versionTag.toString(),
                JsonNodeFactory.instance.objectNode().put("value", "before-migration"),
            )
        )
    }

    private fun createBuildingBlockDocument(
        documentDefinitionName: String,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        value: String = "before-migration",
    ): UUID {
        return createDocument(
            NewDocumentRequest(
                documentDefinitionName,
                null,
                null,
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag.toString(),
                JsonNodeFactory.instance.objectNode().put("value", value),
            )
        )
    }

    private fun createDocument(request: NewDocumentRequest): UUID = runWithoutAuthorization {
        val result = documentService.createDocument(request)
        result.resultingDocument()
            .orElseThrow { IllegalStateException("Document not created: ${result.errors()}") }
            .id()
            .getId()
    }

    private fun definitionOf(id: BuildingBlockDefinitionId): BuildingBlockDefinition =
        buildingBlockDefinitionRepository.findById(id).orElseThrow()

    /** The blueprint version the document is currently homed on. */
    private fun documentVersionOf(documentId: UUID): String = runWithoutAuthorization {
        val document = documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElseThrow()
        (document.definitionId() as JsonSchemaDocumentDefinitionId).blueprintId().blueprintVersionTag().toString()
    }

    /** The `value` field of a document's content — how data handed back by a removal is observed. */
    private fun documentValueOf(documentId: UUID): String? = runWithoutAuthorization {
        documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElseThrow()
            .content().asJson().get("value")?.asText()
    }

    private fun documentExists(documentId: UUID): Boolean = runWithoutAuthorization {
        documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).isPresent
    }

    /** The building block instance homed on a document, or null when it no longer exists. */
    private fun instanceOf(documentId: UUID): BuildingBlockInstance? = transactionTemplate.execute {
        buildingBlockInstanceRepository.findByDocumentId(documentId)
    }

    /** The whole blueprint the document is homed on, `key:version` — needed where the key is what changed. */
    private fun documentBlueprintOf(documentId: UUID): String = runWithoutAuthorization {
        val document = documentRepository.findById(JsonSchemaDocumentId.existingId(documentId)).orElseThrow()
        val blueprintId = (document.definitionId() as JsonSchemaDocumentDefinitionId).blueprintId()
        "${blueprintId.blueprintKey()}:${blueprintId.blueprintVersionTag()}"
    }

    /** The definition the instance points at, a separate fact from the version its document is homed on. */
    private fun definitionIdOf(documentId: UUID): BuildingBlockDefinitionId = transactionTemplate.execute {
        buildingBlockInstanceRepository.findByDocumentId(documentId)!!.definition.id
    }!!

    private fun migratedCount(planId: BlueprintMigrationId): Int = caseMigrationCaseRepository
        .countByIdMigrationIdAndStatus(planId, CaseMigrationCaseStatus.MIGRATED).toInt()

    private fun schemaFor(name: String) = """
        {
          "${'$'}schema": "http://json-schema.org/draft-07/schema#",
          "${'$'}id": "$name.schema",
          "type": "object",
          "properties": {
            "value": {"type": "string"}
          }
        }
    """.trimIndent()

    private fun uniqueSuffix() = UUID.randomUUID().toString().take(8)

    private data class Fixture(
        val casePlanId: BlueprintMigrationId,
        val caseDocumentId: UUID,
        val outerV1: BuildingBlockDefinitionId,
        val outerV2: BuildingBlockDefinitionId,
        val outerPlanId: BlueprintMigrationId,
        val outerDocumentId: UUID,
        val innerKey: String,
        val innerV1: BuildingBlockDefinitionId,
        val innerV2: BuildingBlockDefinitionId,
        val innerPlanId: BlueprintMigrationId,
        val innerDocumentId: UUID,
    )

    private companion object {
        const val V1 = "1.0.0"
        const val V2 = "1.0.1"
        const val NESTED_ACTIVITY_ID = "callInner"
        const val NESTED_VALUE = "from-nested-block"
    }
}
