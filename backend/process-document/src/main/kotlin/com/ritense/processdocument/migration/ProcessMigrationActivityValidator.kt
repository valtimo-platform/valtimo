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

/** The single authority for whether an activity mapping is a valid Operaton migration, mirroring the executor's plan build exactly — including [changedActivityMappings], so an `id -> id` the engine already makes is judged the no-op it is rather than a double-mapped source. */
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
                        ?.let { source -> source to report.failures.map(::readable) }
                }
                .toMap()
        }
    }

    /** The engine's failure with its internal instruction dump written as the mapping the author sees. Everything else is left as the engine worded it. */
    private fun readable(failure: String): String =
        INSTRUCTION_DUMP.replace(failure) { match -> "'${match.groupValues[1]}' -> '${match.groupValues[2]}'" }

    /** The subset of [activityMapping] Operaton accepts. Re-validates after every drop: removing one instruction can be enough for the engine to accept the rest. */
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
        runtimeService.changedActivityMappings(sourceDefinitionId, targetDefinitionId, mapping)
            .forEach { (source, target) -> builder.mapActivities(source, target) }
        builder.build()
    }

    private companion object {
        /** `ValidatingMigrationInstructionImpl{sourceActivity=Activity(a), targetActivity=Activity(b)}` — the engine names its own class at the author. */
        val INSTRUCTION_DUMP =
            """\w*MigrationInstruction\w*\{sourceActivity=Activity\(([^)]*)\), targetActivity=Activity\(([^)]*)\)}"""
                .toRegex()
    }
}
