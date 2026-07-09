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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.migration.domain.ProcessVariablePatch
import com.ritense.valtimo.operaton.repository.OperatonExecutionRepository
import com.ritense.valueresolver.ValueResolverService

/**
 * Resolves a `setProcessVariables` list of [ProcessVariablePatch]es and applies them to a single
 * migrating process instance, using value resolvers so:
 *
 * - `source` (`pv:` / `doc:`) is read from the exact instance being migrated, and
 * - `target` is a value-resolver path written through the resolver. Consistent with
 *   `dataMigration` (whose targets are `doc:` paths), the target must be a full value-resolver
 *   path — for process variables that means `pv:name` or a nested pointer `pv:/config/enabled`
 *   (the resolver merges the nested value into the existing variable's JSON).
 *
 * Shared by the case and building block process-migration executors; call it after the instance
 * has been migrated so the variables are set on the migrated instance (in the same transaction).
 */
class ProcessMigrationVariableResolver(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
    private val operatonExecutionRepository: OperatonExecutionRepository,
) {

    fun apply(processInstanceId: String, patches: List<ProcessVariablePatch>) {
        if (patches.isEmpty()) {
            return
        }

        val sourcePaths = patches.mapNotNull { it.source }.distinct()
        // The instance's root execution is a read-only VariableScope, so value resolvers can read
        // its process variables (pv:) and the document linked to it (doc:).
        val variableScope = if (sourcePaths.isEmpty()) {
            null
        } else {
            operatonExecutionRepository.findById(processInstanceId).orElseThrow {
                NoSuchElementException(
                    "No running process execution found for instance '$processInstanceId' " +
                        "while resolving migration process variables"
                )
            }
        }
        val resolvedSources = if (variableScope == null) {
            emptyMap()
        } else {
            valueResolverService.resolveValues(processInstanceId, variableScope, sourcePaths)
        }

        // key = the target value-resolver path (e.g. "pv:migratedFrom"), value = coerced value
        val targetValues = LinkedHashMap<String, Any?>()
        patches.forEach { patch ->
            if (patch.source != null) {
                // copy: only apply when the source actually resolved (unresolved paths are omitted)
                if (resolvedSources.containsKey(patch.source)) {
                    targetValues[patch.target] = coerce(resolvedSources[patch.source], patch.targetType)
                }
            } else {
                // set: write the literal value
                targetValues[patch.target] = coerce(patch.value, patch.targetType)
            }
        }

        if (targetValues.isNotEmpty()) {
            // The value resolver routes each target by its prefix (pv: for process variables),
            // sets/overwrites the variable and handles nested paths (pv:/a/b) by merging into the
            // existing variable's JSON.
            valueResolverService.handleValues(processInstanceId, variableScope, targetValues)
        }
    }

    private fun coerce(value: Any?, targetType: String?): Any? {
        if (value == null) return null
        return when (targetType?.lowercase()) {
            null -> value
            "string" -> objectMapper.convertValue(value, String::class.java)
            "integer", "long" -> objectMapper.convertValue(value, Long::class.javaObjectType)
            "number", "double" -> objectMapper.convertValue(value, Double::class.javaObjectType)
            "boolean" -> objectMapper.convertValue(value, Boolean::class.javaObjectType)
            else -> value
        }
    }
}
