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

package com.ritense.case_.rest

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.DryRunStatusDto
import com.ritense.case_.service.migration.MigrationExecutionStatusDto
import com.ritense.case_.service.migration.MigrationPlanExporter
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationPlanManagementDto
import com.ritense.case_.service.migration.MigrationSuggestionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
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

@RestController
@SkipComponentScan
@RequestMapping(
    "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/migration",
    produces = [APPLICATION_JSON_UTF8_VALUE]
)
class CaseMigrationManagementResource(
    private val caseMigrationService: CaseMigrationService,
    private val migrationPlanImporter: MigrationPlanImporter,
    private val migrationPlanExporter: MigrationPlanExporter,
    private val migrationSuggestionService: MigrationSuggestionService,
) {

    /** A best-effort, pre-filled plan (source, target, dataMigration, processMigration) for a new plan. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion")
    fun suggestMigrationPlan(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<JsonNode> {
        val target = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(migrationSuggestionService.suggestPlan(target))
    }

    /** A best-effort activity mapping (`sourceActivityId -> targetActivityId`) for a process pair. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion/activity-mapping")
    fun suggestActivityMapping(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
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
     * incompatible pairs while the user works. Returns the incompatible pairs (keyed by source
     * activity id with the engine's failure messages); an empty map means every pair is valid. This is
     * an inspection endpoint (always `200`); the plan save itself rejects an invalid plan. The engine
     * is the single source of truth for compatibility.
     */
    @RunWithoutAuthorization
    @PostMapping("/suggestion/activity-mapping/validate")
    fun validateActivityMapping(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
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

    /**
     * A best-effort `{ dataMigration, processMigration }` for one building-block entry of this case
     * plan. `mode=add` moves data/process from the owner case into the building block; `mode=remove`
     * moves them back from the building block to the owner case.
     */
    @RunWithoutAuthorization
    @GetMapping("/suggestion/building-block")
    fun suggestBuildingBlockEntry(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestParam buildingBlockKey: String,
        @RequestParam buildingBlockVersionTag: String,
        @RequestParam(defaultValue = "add") mode: String,
    ): ResponseEntity<JsonNode> {
        val owner = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val block = BuildingBlockDefinitionId(buildingBlockKey, buildingBlockVersionTag)
        val suggestion =
            if (mode == "remove") migrationSuggestionService.suggestBuildingBlockEntry(block, owner)
            else migrationSuggestionService.suggestBuildingBlockEntry(owner, block)
        return ResponseEntity.ok(suggestion)
    }

    /** All migration plans for the case definition version, with their configuration and status. */
    @RunWithoutAuthorization
    @GetMapping
    fun getMigrationPlans(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<List<MigrationPlanManagementDto>> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        return ResponseEntity.ok(caseMigrationService.getPlans(caseDefinitionId))
    }

    /** The full migration plan JSON for editing, or 404 when the plan does not exist. */
    @RunWithoutAuthorization
    @GetMapping("/{migrationKey}")
    fun getMigrationPlan(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<JsonNode> {
        val json = migrationPlanExporter.getPlanJson(migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey))
        return if (json != null) ResponseEntity.ok(json) else ResponseEntity.notFound().build()
    }

    /** Create or update a migration plan from its JSON (the plan's `key` is taken from the body). */
    @RunWithoutAuthorization
    @PostMapping
    fun saveMigrationPlan(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestBody plan: JsonNode,
    ): ResponseEntity<List<MigrationPlanManagementDto>> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val problems = migrationSuggestionService.findPlanProblems(caseDefinitionId, plan)
        if (problems.isNotEmpty()) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Migration plan has incompatible activity mappings: ${problems.joinToString("; ")}",
            )
        }
        migrationPlanImporter.deploy(caseDefinitionId, plan)
        return ResponseEntity.ok(caseMigrationService.getPlans(caseDefinitionId))
    }

    @RunWithoutAuthorization
    @DeleteMapping("/{migrationKey}")
    fun deleteMigrationPlan(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<Void> {
        caseMigrationService.deletePlan(migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey))
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    /** Manual (button) trigger: start the migration plan now. */
    @RunWithoutAuthorization
    @PostMapping("/{migrationKey}/start")
    fun startMigration(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<MigrationExecutionStatusDto> {
        val migrationId = migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey)
        caseMigrationService.startMigration(migrationId)
        return ResponseEntity.ok(caseMigrationService.getStatus(migrationId))
    }

    @RunWithoutAuthorization
    @GetMapping("/{migrationKey}/status")
    fun getMigrationStatus(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<MigrationExecutionStatusDto> {
        val migrationId = migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey)
        return ResponseEntity.ok(caseMigrationService.getStatus(migrationId))
    }

    /** Manual (button) trigger: dry-run the migration plan now — simulate it without migrating any case. */
    @RunWithoutAuthorization
    @PostMapping("/{migrationKey}/dry-run")
    fun startDryRun(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<DryRunStatusDto> {
        val migrationId = migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey)
        return ResponseEntity.ok(caseMigrationService.startDryRun(migrationId))
    }

    @RunWithoutAuthorization
    @GetMapping("/{migrationKey}/dry-run/status")
    fun getDryRunStatus(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<DryRunStatusDto> {
        val migrationId = migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey)
        return ResponseEntity.ok(caseMigrationService.getDryRunStatus(migrationId))
    }

    private fun migrationId(caseDefinitionKey: String, caseDefinitionVersionTag: String, migrationKey: String) =
        BlueprintMigrationId.from(CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag), migrationKey)
}
