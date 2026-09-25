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
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException
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
        // Before deserialization: an unknown key must be named as such, not surface as whatever the mapper makes of it.
        rejectUnknownPlanKeys(objectNode)
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
                    deployComponent(deployer, migrationId, component)
                }
        }
    }

    /** A deployer parses its own section strictly, so an unknown property arrives as a Jackson error. Said in the plan's own terms instead, and as the [IllegalArgumentException] the save path answers as a 400. */
    private fun deployComponent(
        deployer: MigrationComponentDeployer,
        migrationId: BlueprintMigrationId,
        component: JsonNode,
    ) {
        try {
            deployer.deploy(migrationId, component)
        } catch (e: Exception) {
            // convertValue wraps it, so the unknown property is somewhere down the cause chain rather than thrown as itself.
            val unknown = generateSequence<Throwable>(e) { it.cause }
                .filterIsInstance<UnrecognizedPropertyException>()
                .firstOrNull()
                ?: throw e
            throw IllegalArgumentException(
                "Migration plan has an unknown property '${unknown.propertyName}' in " +
                    "'${deployer.componentKey()}'. Known properties there are " +
                    unknown.knownPropertyIds.orEmpty().sortedBy { it.toString() }.joinToString { "'$it'" } + ".",
                e,
            )
        }
    }

    /** A misspelled component section is silently dropped rather than deployed, so `dataMigraton` loses every patch under it and the plan still saves. The plan DTO cannot catch this itself: it has to ignore unknown keys, because the component sections are exactly that to it. */
    private fun rejectUnknownPlanKeys(objectNode: ObjectNode) {
        val allowed = PLAN_LEVEL_KEYS + componentDeployers.map { it.componentKey() }
        val unknown = objectNode.fieldNames().asSequence().filterNot { it in allowed }.toList()
        require(unknown.isEmpty()) {
            "Migration plan has ${if (unknown.size == 1) "an unknown property" else "unknown properties"} " +
                unknown.joinToString { "'$it'" } + ". Known properties are " +
                allowed.sorted().joinToString { "'$it'" } + "."
        }
        val unknownSource = objectNode.get("source")?.takeIf { it.isObject }
            ?.fieldNames()?.asSequence()?.filterNot { it in SOURCE_KEYS }?.toList().orEmpty()
        require(unknownSource.isEmpty()) {
            "Migration plan has ${if (unknownSource.size == 1) "an unknown property" else "unknown properties"} " +
                unknownSource.joinToString { "'$it'" } + " in 'source'. Known properties there are " +
                SOURCE_KEYS.sorted().joinToString { "'$it'" } + "."
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

        /** Every property [MigrationPlanDeploymentDto] declares; the component sections are added per deployer. */
        val PLAN_LEVEL_KEYS = setOf("key", "source", "title", "migrationTriggers", "conditions")

        /** Every property [MigrationPlanSourceDto] declares. */
        val SOURCE_KEYS = setOf("key", "versionTag")

        // Matches both `<name>.case-migration.json` and `<name>.building-block-migration.json`.
        val FILENAME_REGEX =
            """/(?:case|building-block)-migration/([^/]+)\.(?:case|building-block)-migration\.json""".toRegex()
    }
}
