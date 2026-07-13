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

package com.ritense.processdocument.migration

import com.ritense.valtimo.contract.blueprint.migration.ActivityMappingValidator
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.migration.MigrationPlanValidationException

/**
 * The single authority for whether an activity mapping is a valid Operaton migration, delegating to
 * the engine itself so the suggester, API and UI all agree with what will actually happen at
 * execution. It mirrors [ProcessMigrationComponentExecutor]'s plan build exactly
 * (`mapEqualActivities()` + explicit `mapActivities`), so a mapping accepted here is accepted when
 * the migration runs, and a mapping rejected here is rejected there.
 *
 * Note the engine already maps unchanged (equal) activities via `mapEqualActivities()`, so callers
 * only pass the *changed* mappings; passing an explicit `id -> id` for an equal activity would
 * double-map its source and be rejected by the engine's `OnlyOnceMappedActivityInstructionValidator`.
 */
class ProcessMigrationActivityValidator(
    private val runtimeService: RuntimeService,
) : ActivityMappingValidator {

    override fun findInvalidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, List<String>> {
        if (activityMapping.isEmpty()) {
            return emptyMap()
        }
        return try {
            buildPlan(sourceProcessDefinitionId, targetProcessDefinitionId, activityMapping)
            emptyMap()
        } catch (e: MigrationPlanValidationException) {
            e.validationReport.instructionReports
                .filter { it.hasFailures() }
                .mapNotNull { report ->
                    report.migrationInstruction.sourceActivityId
                        ?.takeIf { it in activityMapping }
                        ?.let { source -> source to report.failures }
                }
                .toMap()
        }
    }

    /**
     * The subset of [activityMapping] Operaton accepts. Re-validates after every drop, because
     * removing one incompatible instruction can be enough for the engine to accept the rest.
     */
    fun retainValidActivityMappings(
        sourceProcessDefinitionId: String,
        targetProcessDefinitionId: String,
        activityMapping: Map<String, String>,
    ): Map<String, String> {
        var remaining = activityMapping
        repeat(activityMapping.size) {
            val invalid = findInvalidActivityMappings(sourceProcessDefinitionId, targetProcessDefinitionId, remaining)
            if (invalid.isEmpty()) {
                return remaining
            }
            remaining = remaining.filterKeys { it !in invalid }
            if (remaining.isEmpty()) {
                return emptyMap()
            }
        }
        return remaining
    }

    private fun buildPlan(sourceDefinitionId: String, targetDefinitionId: String, mapping: Map<String, String>) {
        val builder = runtimeService.createMigrationPlan(sourceDefinitionId, targetDefinitionId).mapEqualActivities()
        mapping.forEach { (source, target) -> builder.mapActivities(source, target) }
        builder.build()
    }
}
