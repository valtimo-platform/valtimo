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
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION_MIGRATION
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentDeployer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

/**
 * Imports and auto-deploys `*.migration.json` files. The importer owns the plan skeleton and
 * dispatches each component section (`dataMigration`, `processMigration`, ...) to the matching
 * [MigrationComponentDeployer], so components owned by other (possibly unlinked) modules are
 * deployed without this module depending on them.
 */
@Transactional
class MigrationPlanImporter(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val componentDeployers: List<MigrationComponentDeployer>,
) : Importer {

    override fun type() = CASE_DEFINITION_MIGRATION

    override fun dependsOn() = setOf(CASE_DEFINITION, DOCUMENT_DEFINITION)

    override fun partOfCaseDefinition() = true

    override fun partOfBuildingBlockDefinition() = false

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val caseDefinitionId = requireNotNull(request.caseDefinitionId) {
            "A migration plan can only be imported as part of a case definition"
        }

        val tree = try {
            objectMapper.readTree(request.content) as? ObjectNode
                ?: throw IllegalArgumentException("Migration plan must be a JSON object")
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as a valid migration plan: ${e.message}", e)
        }

        deploy(caseDefinitionId, tree)
    }

    /**
     * Deploy (create or overwrite) a migration plan for [caseDefinitionId] from its JSON [tree]:
     * persist the skeleton and dispatch each component section to its [MigrationComponentDeployer].
     * Used by the file auto-deploy [import] and by the management UI (create/edit).
     */
    fun deploy(caseDefinitionId: CaseDefinitionId, tree: JsonNode) {
        val objectNode = tree as? ObjectNode
            ?: throw IllegalArgumentException("Migration plan must be a JSON object")
        val dto = objectMapper.treeToValue(objectNode, MigrationPlanDeploymentDto::class.java)
        require(dto.key.isNotBlank()) { "A migration plan requires a non-blank 'key'" }
        val migrationId = CaseDefinitionMigrationId(caseDefinitionId, dto.key)

        logger.debug { "Deploying migration plan '${dto.key}' for case definition '$caseDefinitionId'" }

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

    private companion object {
        val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/case-migration/([^/]+)\.case-migration\.json""".toRegex()
    }
}
