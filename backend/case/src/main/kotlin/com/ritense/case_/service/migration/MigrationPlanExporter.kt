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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.MigrationPlanExportRequest
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import org.springframework.transaction.annotation.Transactional

/**
 * Reconstructs the migration plan file(s) for a blueprint version (case definition or building
 * block definition) from the plan skeleton plus each [MigrationComponentDeployer]'s exported
 * component.
 */
@Transactional(readOnly = true)
class MigrationPlanExporter(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val componentDeployers: List<MigrationComponentDeployer>,
) : Exporter<MigrationPlanExportRequest> {

    override fun supports() = MigrationPlanExportRequest::class.java

    override fun export(request: MigrationPlanExportRequest): ExportResult {
        val blueprintId = request.blueprintId
        val migrations = caseDefinitionMigrationRepository.findAllByIdBlueprintTypeAndIdKeyAndIdVersionTag(
            blueprintId.blueprintType(), blueprintId.getIdKey(), blueprintId.blueprintVersionTag()
        )
        if (migrations.isEmpty()) return ExportResult()

        val key = blueprintId.getIdKey()
        val formattedVersion = blueprintId.blueprintVersionTag().let { "${it.major}-${it.minor}-${it.patch}" }
        val pathTemplate = when (blueprintId.blueprintType()) {
            BlueprintType.CASE -> CASE_PATH
            BlueprintType.BUILDING_BLOCK -> BUILDING_BLOCK_PATH
        }

        val exportFiles = migrations.map { migration ->
            ExportFile(
                pathTemplate.format(key, formattedVersion, migration.id.migrationKey),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(buildPlanJson(migration))
            )
        }.toSet()

        return ExportResult(exportFiles)
    }

    /** The full `*.migration.json` for a single plan (skeleton + components), or null if absent. */
    @Transactional(readOnly = true)
    fun getPlanJson(migrationId: BlueprintMigrationId): ObjectNode? {
        return caseDefinitionMigrationRepository.findById(migrationId).map { buildPlanJson(it) }.orElse(null)
    }

    private fun buildPlanJson(migration: CaseDefinitionMigration): ObjectNode {
        val root = objectMapper.createObjectNode()
        root.put("title", migration.title)
        root.put("key", migration.id.migrationKey)
        migration.sourceBlueprintType?.let { root.put("sourceBlueprintType", it.name) }
        migration.sourceKey?.let { root.put("sourceKey", it) }
        migration.sourceVersionTag?.let { root.put("sourceVersionTag", it.toString()) }
        migration.targetBlueprintType?.let { root.put("targetBlueprintType", it.name) }
        migration.targetKey?.let { root.put("targetKey", it) }
        migration.targetVersionTag?.let { root.put("targetVersionTag", it.toString()) }
        root.set<ObjectNode>("migrationTriggers", objectMapper.valueToTree(migration.migrationTriggers))
        root.set<ObjectNode>("conditions", objectMapper.valueToTree(migration.conditions))

        componentDeployers.forEach { deployer ->
            deployer.getComponentToExport(migration.id)?.let { component ->
                root.set<ObjectNode>(deployer.componentKey(), objectMapper.valueToTree(component))
            }
        }
        return root
    }

    companion object {
        private const val CASE_PATH = "config/case/%s/%s/case-migration/%s.case-migration.json"
        private const val BUILDING_BLOCK_PATH =
            "config/building-block/%s/%s/building-block-migration/%s.building-block-migration.json"
    }
}
