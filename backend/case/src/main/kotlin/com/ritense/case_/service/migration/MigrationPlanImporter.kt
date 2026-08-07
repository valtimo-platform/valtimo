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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION_MIGRATION
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

/**
 * Imports and auto-deploys migration plan files (`*.migration.json`) for both case definitions and
 * building block definitions. The importer owns the plan skeleton and dispatches each component
 * section (`dataMigration`, `processMigration`, ...) to the matching [MigrationComponentDeployer],
 * so components owned by other (possibly unlinked) modules are deployed without this module
 * depending on them.
 *
 * The plan is keyed by the blueprint it targets (taken from [ImportRequest.getBlueprintId] — a case
 * definition version when part of a case, a building block definition version when part of a
 * building block), so the same file format serves both.
 */
@Transactional
class MigrationPlanImporter(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val componentDeployers: List<MigrationComponentDeployer>,
) : Importer {

    override fun type() = CASE_DEFINITION_MIGRATION

    // No dependsOn: a migration plan only stores configuration keyed by the blueprint id from the
    // import request; it does not read other imported definitions at deploy time. Declaring case- or
    // building-block-specific dependencies would filter this dual-mode importer out of the other flow.
    override fun dependsOn() = emptySet<String>()

    override fun partOfCaseDefinition() = true

    override fun partOfBuildingBlockDefinition() = true

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val blueprintId = requireNotNull(request.getBlueprintId()) {
            "A migration plan can only be imported as part of a case or building block definition"
        }

        val tree = try {
            objectMapper.readTree(request.content) as? ObjectNode
                ?: throw IllegalArgumentException("Migration plan must be a JSON object")
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as a valid migration plan: ${e.message}", e)
        }

        deploy(blueprintId, tree)
    }

    /**
     * Deploy (create or overwrite) a migration plan for [blueprintId] from its JSON [tree]:
     * persist the skeleton and dispatch each component section to its [MigrationComponentDeployer].
     * Used by the file auto-deploy [import] and by the management UI (create/edit).
     */
    fun deploy(blueprintId: BlueprintId, tree: JsonNode) {
        val objectNode = tree as? ObjectNode
            ?: throw IllegalArgumentException("Migration plan must be a JSON object")
        val dto = objectMapper.treeToValue(objectNode, MigrationPlanDeploymentDto::class.java)
        require(dto.key.isNotBlank()) { "A migration plan requires a non-blank 'key'" }
        val isBuildingBlockPlan = blueprintId.blueprintType() == BlueprintType.BUILDING_BLOCK
        if (isBuildingBlockPlan) {
            rejectTriggersAndConditions(objectNode, dto.key, blueprintId)
        }
        MigrationConditionValidator.validate(dto.conditions)
        val migrationId = BlueprintMigrationId.from(blueprintId, dto.key)

        logger.debug { "Deploying migration plan '${dto.key}' for blueprint '$blueprintId'" }

        // Make (re)deploys idempotent: clear previously deployed component data first.
        componentDeployers.forEach { it.undeploy(migrationId) }

        caseDefinitionMigrationRepository.save(
            CaseDefinitionMigration(
                id = migrationId,
                title = dto.title,
                migrationTriggers = dto.migrationTriggers,
                conditions = dto.conditions,
            )
        )

        componentDeployers.forEach { deployer ->
            objectNode.get(deployer.componentKey())
                ?.takeUnless { it.isNull }
                ?.let { component ->
                    logger.debug { "Deploying migration component '${deployer.componentKey()}' for '$migrationId'" }
                    deployer.deploy(migrationId, component)
                }
        }
    }

    /**
     * A building block migration plan may not carry `migrationTriggers` or `conditions`.
     *
     * A building block does not migrate on its own schedule and does not choose its own instances: it
     * migrates because a case migration brought it onto this version, and it applies to exactly the
     * instances that case migration carries with it. Accepting these fields and quietly ignoring them
     * would let an author believe their instances are being filtered when every one of them is in fact
     * being migrated, so they are refused outright.
     */
    private fun rejectTriggersAndConditions(plan: ObjectNode, planKey: String, blueprintId: BlueprintId) {
        val present = REJECTED_BUILDING_BLOCK_FIELDS.filter { field ->
            plan.get(field)?.takeUnless { it.isNull || it.isEmpty } != null
        }
        if (present.isNotEmpty()) {
            throw IllegalArgumentException(
                "Building block migration plan '$planKey' for '$blueprintId' declares ${present.joinToString(" and ")}, " +
                    "which a building block plan does not support. A building block migrates when a case " +
                    "migration moves it onto this version, so it has no trigger of its own and applies to " +
                    "every instance that migration brings with it."
            )
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}

        val REJECTED_BUILDING_BLOCK_FIELDS = listOf("migrationTriggers", "conditions")

        // Matches both a case migration plan (…/case-migration/<name>.case-migration.json) and a
        // building block migration plan (…/building-block-migration/<name>.building-block-migration.json).
        val FILENAME_REGEX =
            """/(?:case|building-block)-migration/([^/]+)\.(?:case|building-block)-migration\.json""".toRegex()
    }
}
