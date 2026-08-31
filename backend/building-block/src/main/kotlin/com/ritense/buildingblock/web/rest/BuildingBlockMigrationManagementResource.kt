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

/** Building block counterpart of the case migration management API, over the same blueprint-agnostic services. */
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

    /** A best-effort pre-filled plan for this building block version. A source with a different key is legal — that is how one building block replaces another. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion")
    fun suggestMigrationPlan(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestParam(required = false) sourceKey: String?,
        @RequestParam(required = false) sourceVersionTag: String?,
    ): ResponseEntity<JsonNode> {
        val target = BuildingBlockDefinitionId(key, versionTag)
        val source = sourceVersionTag?.takeUnless { it.isBlank() }?.let {
            BuildingBlockDefinitionId(sourceKey?.takeUnless { candidate -> candidate.isBlank() } ?: key, it)
        }
        return ResponseEntity.ok(migrationSuggestionService.suggestPlan(target, source))
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

    /** The incompatible pairs of a proposed activity mapping. An inspection endpoint — always 200; the plan save is what rejects. */
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

    /** A best-effort suggestion for one nested building-block entry. The owner is the blueprint whose call activity declares the block, which two levels down is the block in between. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion/building-block")
    fun suggestBuildingBlockEntry(
        @PathVariable key: String,
        @PathVariable versionTag: String,
        @RequestParam buildingBlockKey: String,
        @RequestParam buildingBlockVersionTag: String,
        @RequestParam(defaultValue = "add") mode: String,
        @RequestParam(required = false) sourceKey: String?,
        @RequestParam(required = false) sourceVersionTag: String?,
    ): ResponseEntity<JsonNode> {
        val target = BuildingBlockDefinitionId(key, versionTag)
        val source = sourceVersionTag?.takeUnless { it.isBlank() }?.let {
            BuildingBlockDefinitionId(sourceKey?.takeUnless { candidate -> candidate.isBlank() } ?: key, it)
        }
        val nested = BuildingBlockDefinitionId(buildingBlockKey, buildingBlockVersionTag)
        val removing = mode == "remove"
        val owner = migrationSuggestionService.entryOwnerOf(if (removing) source ?: target else target, nested)
        val suggestion =
            if (removing) migrationSuggestionService.suggestBuildingBlockEntry(nested, owner)
            else migrationSuggestionService.suggestBuildingBlockEntry(owner, nested)
        suggestion.set<JsonNode>("owner", migrationSuggestionService.describeEntryOwner(owner))
        return ResponseEntity.ok(suggestion)
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
                "Migration plan cannot be saved: ${problems.joinToString("; ")}",
            )
        }
        // As on the case save path: the importer refuses a malformed plan with IllegalArgumentException, and it is the caller's plan that is wrong.
        try {
            migrationPlanImporter.deploy(blueprintId, plan)
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, e.message, e)
        }
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

    /** How far this plan has got, in instances applied to. No `start` or `dry-run`: a building block plan is applied by the case migration that moves its block, never run. */
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
