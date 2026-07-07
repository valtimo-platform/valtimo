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
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentDeployer
import org.springframework.transaction.annotation.Transactional

/**
 * Reconstructs the `*.migration.json` file(s) for a case definition version from the plan
 * skeleton plus each [MigrationComponentDeployer]'s exported component.
 */
@Transactional(readOnly = true)
class MigrationPlanExporter(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    private val componentDeployers: List<MigrationComponentDeployer>,
) : Exporter<MigrationPlanExportRequest> {

    override fun supports() = MigrationPlanExportRequest::class.java

    override fun export(request: MigrationPlanExportRequest): ExportResult {
        val migrations = caseDefinitionMigrationRepository.findAllByIdCaseDefinitionId(request.caseDefinitionId)
        if (migrations.isEmpty()) return ExportResult()

        val caseDefinitionKey = request.caseDefinitionId.key
        val formattedVersion = request.caseDefinitionId.versionTag.let { "${it.major}-${it.minor}-${it.patch}" }

        val exportFiles = migrations.map { migration ->
            ExportFile(
                PATH.format(caseDefinitionKey, formattedVersion, migration.id.migrationKey),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(buildPlanJson(migration))
            )
        }.toSet()

        return ExportResult(exportFiles)
    }

    /** The full `*.migration.json` for a single plan (skeleton + components), or null if absent. */
    @Transactional(readOnly = true)
    fun getPlanJson(migrationId: CaseDefinitionMigrationId): ObjectNode? {
        return caseDefinitionMigrationRepository.findById(migrationId).map { buildPlanJson(it) }.orElse(null)
    }

    private fun buildPlanJson(migration: CaseDefinitionMigration): ObjectNode {
        val root = objectMapper.createObjectNode()
        root.put("title", migration.title)
        root.put("key", migration.id.migrationKey)
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
        private const val PATH = "config/case/%s/%s/case-migration/%s.case-migration.json"
    }
}
