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

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.MigrationExecutionStatusDto
import com.ritense.case_.service.migration.MigrationPlanExporter
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationPlanManagementDto
import com.ritense.case_.service.migration.MigrationSuggestionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/**
 * Building block counterpart of the case migration management API. Delegates to the same
 * (blueprint-agnostic) migration services, keying every plan by the building block definition.
 */
@RestController
@SkipComponentScan
@RequestMapping(
    "/api/management/v1/building-block/{key}/version/{versionTag}/migration",
    produces = [APPLICATION_JSON_UTF8_VALUE]
)
class BuildingBlockMigrationManagementResource(
    private val caseMigrationService: CaseMigrationService,
    private val migrationPlanImporter: MigrationPlanImporter,
    private val migrationPlanExporter: MigrationPlanExporter,
    private val migrationSuggestionService: MigrationSuggestionService,
) {

    /** A best-effort, pre-filled plan (source, target, dataMigration, processMigration) for a new plan. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion")
    fun suggestMigrationPlan(
        @PathVariable key: String,
        @PathVariable versionTag: String,
    ): ResponseEntity<JsonNode> {
        return ResponseEntity.ok(migrationSuggestionService.suggestPlan(BuildingBlockDefinitionId(key, versionTag)))
    }

    /** A best-effort activity mapping (`sourceActivityId -> targetActivityId`) for a process pair. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion/activity-mapping")
    fun suggestActivityMapping(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestParam sourceProcessDefinitionId: String,
        @RequestParam targetProcessDefinitionId: String,
    ): ResponseEntity<Map<String, String>> {
        return ResponseEntity.ok(
            migrationSuggestionService.suggestActivityMapping(
                sourceProcessDefinitionId,
                targetProcessDefinitionId,
            )
        )
    }

    /**
     * Checks a proposed activity mapping against the engine's migration rules so the editor can flag
     * incompatible pairs; returns the incompatible pairs (empty when all valid). Inspection endpoint
     * (always `200`); the plan save itself rejects an invalid plan.
     */
    @RunWithoutAuthorization
    @PostMapping("/suggestion/activity-mapping/validate")
    fun validateActivityMapping(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestParam sourceProcessDefinitionId: String,
        @RequestParam targetProcessDefinitionId: String,
        @RequestBody activityMapping: Map<String, String>,
    ): ResponseEntity<Map<String, List<String>>> {
        return ResponseEntity.ok(
            migrationSuggestionService.findInvalidActivityMappings(
                sourceProcessDefinitionId,
                targetProcessDefinitionId,
                activityMapping,
            )
        )
    }

    @RunWithoutAuthorization
    @GetMapping
    fun getMigrationPlans(
        @PathVariable key: String,
        @PathVariable versionTag: String,
    ): ResponseEntity<List<MigrationPlanManagementDto>> {
        return ResponseEntity.ok(caseMigrationService.getPlans(BuildingBlockDefinitionId(key, versionTag)))
    }

    @RunWithoutAuthorization
    @GetMapping("/{migrationKey}")
    fun getMigrationPlan(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<JsonNode> {
        val json = migrationPlanExporter.getPlanJson(migrationId(key, versionTag, migrationKey))
        return if (json != null) ResponseEntity.ok(json) else ResponseEntity.notFound().build()
    }

    @RunWithoutAuthorization
    @PostMapping
    fun saveMigrationPlan(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestBody plan: JsonNode,
    ): ResponseEntity<List<MigrationPlanManagementDto>> {
        val blueprintId = BuildingBlockDefinitionId(key, versionTag)
        val problems = migrationSuggestionService.findPlanProblems(blueprintId, plan)
        if (problems.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Migration plan has incompatible activity mappings: ${problems.joinToString("; ")}",
            )
        }
        migrationPlanImporter.deploy(blueprintId, plan)
        return ResponseEntity.ok(caseMigrationService.getPlans(blueprintId))
    }

    @RunWithoutAuthorization
    @DeleteMapping("/{migrationKey}")
    fun deleteMigrationPlan(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<Void> {
        caseMigrationService.deletePlan(migrationId(key, versionTag, migrationKey))
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @RunWithoutAuthorization
    @PostMapping("/{migrationKey}/start")
    fun startMigration(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<MigrationExecutionStatusDto> {
        val migrationId = migrationId(key, versionTag, migrationKey)
        caseMigrationService.startMigration(migrationId)
        return ResponseEntity.ok(caseMigrationService.getStatus(migrationId))
    }

    @RunWithoutAuthorization
    @GetMapping("/{migrationKey}/status")
    fun getMigrationStatus(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<MigrationExecutionStatusDto> {
        val migrationId = migrationId(key, versionTag, migrationKey)
        return ResponseEntity.ok(caseMigrationService.getStatus(migrationId))
    }

    private fun migrationId(key: String, versionTag: String, migrationKey: String) =
        BlueprintMigrationId.from(BuildingBlockDefinitionId(key, versionTag), migrationKey)
}
