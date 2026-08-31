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
import com.ritense.case_.service.migration.CaseMigrationRunner
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
    private val caseMigrationRunner: CaseMigrationRunner,
    private val migrationPlanImporter: MigrationPlanImporter,
    private val migrationPlanExporter: MigrationPlanExporter,
    private val migrationSuggestionService: MigrationSuggestionService,
) {

    /** A best-effort pre-filled plan for a new plan on this case definition version; omitting [sourceKey]/[sourceVersionTag] falls back to this version's predecessor. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion")
    fun suggestMigrationPlan(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestParam(required = false) sourceKey: String?,
        @RequestParam(required = false) sourceVersionTag: String?,
    ): ResponseEntity<JsonNode> {
        val target = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val source = sourceVersionTag?.takeUnless { it.isBlank() }?.let {
            CaseDefinitionId(sourceKey?.takeUnless { key -> key.isBlank() } ?: caseDefinitionKey, it)
        }
        return ResponseEntity.ok(migrationSuggestionService.suggestPlan(target, source))
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

    /** The incompatible pairs of a proposed activity mapping, as the engine judges them. An inspection endpoint — always 200; the plan save is what rejects. */
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

    /** A best-effort suggestion for one building-block entry. The owner is read from the running tree rather than assumed to be the case, and echoed back because the editor cannot work it out either. */
    @RunWithoutAuthorization
    @GetMapping("/suggestion/building-block")
    fun suggestBuildingBlockEntry(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @RequestParam buildingBlockKey: String,
        @RequestParam buildingBlockVersionTag: String,
        @RequestParam(defaultValue = "add") mode: String,
        @RequestParam(required = false) sourceKey: String?,
        @RequestParam(required = false) sourceVersionTag: String?,
    ): ResponseEntity<JsonNode> {
        val target = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val source = sourceVersionTag?.takeUnless { it.isBlank() }?.let {
            CaseDefinitionId(sourceKey?.takeUnless { key -> key.isBlank() } ?: caseDefinitionKey, it)
        }
        val block = BuildingBlockDefinitionId(buildingBlockKey, buildingBlockVersionTag)
        val removing = mode == "remove"
        val owner = migrationSuggestionService.entryOwnerOf(if (removing) source ?: target else target, block)
        val suggestion =
            if (removing) migrationSuggestionService.suggestBuildingBlockEntry(block, owner)
            else migrationSuggestionService.suggestBuildingBlockEntry(owner, block)
        suggestion.set<JsonNode>("owner", migrationSuggestionService.describeEntryOwner(owner))
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
                "Migration plan cannot be saved: ${problems.joinToString("; ")}",
            )
        }
        asBadRequestOnInvalidPlan { migrationPlanImporter.deploy(caseDefinitionId, plan) }
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

    /** Manual trigger: start the plan now, refused unless it declares `triggeredByButton`. Checked here rather than in the service, which the trigger sweep calls for plans that have no button. */
    @RunWithoutAuthorization
    @PostMapping("/{migrationKey}/start")
    fun startMigration(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @PathVariable migrationKey: String,
    ): ResponseEntity<MigrationExecutionStatusDto> {
        val migrationId = migrationId(caseDefinitionKey, caseDefinitionVersionTag, migrationKey)
        if (!caseMigrationService.isTriggeredByButton(migrationId)) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Migration plan '$migrationKey' cannot be started manually: it does not have the " +
                    "'triggered by button' trigger. Add that trigger to the plan, or let it run on its " +
                    "scheduled date or after the plan it follows.",
            )
        }
        // Background: migrating every matching case takes hours. The client follows the rest by polling GET .../status.
        val started = asBadRequestOnInvalidPlan { caseMigrationRunner.startMigration(migrationId) }
        val status = caseMigrationService.getStatus(migrationId)
        // Already running: not an error, there is simply nothing new to accept.
        return if (started) ResponseEntity.accepted().body(status) else ResponseEntity.ok(status)
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
        // Background for the same reason: a dry run simulates every case it would migrate.
        val started = asBadRequestOnInvalidPlan { caseMigrationRunner.startDryRun(migrationId) }
        val status = caseMigrationService.getDryRunStatus(migrationId)
        return if (started) ResponseEntity.accepted().body(status) else ResponseEntity.ok(status)
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

    /** Run [block], answering 400 rather than 500 when it is the plan that is wrong — everything below refuses a bad plan with `require`, which Spring would otherwise render as a server fault. */
    private fun <T> asBadRequestOnInvalidPlan(block: () -> T): T =
        try {
            block()
        } catch (e: IllegalArgumentException) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, e.message, e)
        }

    private fun migrationId(caseDefinitionKey: String, caseDefinitionVersionTag: String, migrationKey: String) =
        BlueprintMigrationId.from(CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag), migrationKey)
}
