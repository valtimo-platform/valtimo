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
import org.semver4j.Semver
import org.springframework.transaction.annotation.Transactional

/** Imports `*.migration.json` for both blueprint types, dispatching each component section to its [MigrationComponentDeployer]. Validates the plan's shape only — deploy order is not guaranteed. */
@Transactional
class MigrationPlanImporter(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val componentDeployers: List<MigrationComponentDeployer>,
) : Importer {

    override fun type() = CASE_DEFINITION_MIGRATION

    // No dependsOn: a plan reads no other imported definition, and case- or block-specific dependencies would filter this dual-mode importer out of the other flow.
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

    /** Deploy (create or overwrite) a plan for [blueprintId] from [tree]. Used by file auto-deploy and by the management UI. */
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
        val source = resolveSource(dto, blueprintId)
        val migrationId = BlueprintMigrationId.from(blueprintId, dto.key)

        logger.debug { "Deploying migration plan '${dto.key}' migrating '$source' to '$blueprintId'" }

        // Make (re)deploys idempotent: clear previously deployed component data first.
        componentDeployers.forEach { it.undeploy(migrationId) }

        caseDefinitionMigrationRepository.save(
            CaseDefinitionMigration(
                id = migrationId,
                sourceKey = source.getIdKey(),
                sourceVersionTag = source.blueprintVersionTag(),
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

    /** The blueprint version the plan migrates FROM, never inferred from the target — that is what lets one plan span several versions or name a different key. `key` may be omitted; the version may not. */
    private fun resolveSource(dto: MigrationPlanDeploymentDto, target: BlueprintId): BlueprintId {
        val source = requireNotNull(dto.source) {
            "Migration plan '${dto.key}' for '$target' declares no 'source'. Every plan states the " +
                "blueprint version it migrates instances from, as " +
                """{"source": {"key": "${target.getIdKey()}", "versionTag": "<version>"}}""" +
                " ('key' may be omitted when it is the same as the target's)."
        }
        val sourceKey = source.key?.takeUnless { it.isBlank() } ?: target.getIdKey()
        val versionTag = requireNotNull(source.versionTag?.takeUnless { it.isBlank() }) {
            "Migration plan '${dto.key}' for '$target' declares a 'source' without a 'versionTag'"
        }
        val sourceVersion = requireNotNull(Semver.parse(versionTag)) {
            "Migration plan '${dto.key}' for '$target' declares source version '$versionTag', " +
                "which is not a valid semantic version"
        }
        val sourceId = BlueprintMigrationId.blueprintIdOf(target.blueprintType(), sourceKey, sourceVersion)
        require(sourceId != target) {
            "Migration plan '${dto.key}' for '$target' declares '$target' as its own source. A plan " +
                "migrates instances from one blueprint version to another, so its source and target " +
                "cannot be the same version."
        }
        return sourceId
    }

    /** A building block plan may not carry `migrationTriggers` or `conditions`: it migrates exactly the instances a case migration carries with it, so accepting and ignoring them would mislead. */
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

        // Matches both `<name>.case-migration.json` and `<name>.building-block-migration.json`.
        val FILENAME_REGEX =
            """/(?:case|building-block)-migration/([^/]+)\.(?:case|building-block)-migration\.json""".toRegex()
    }
}
