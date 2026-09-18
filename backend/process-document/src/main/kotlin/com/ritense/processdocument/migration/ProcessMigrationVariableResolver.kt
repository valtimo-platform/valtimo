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

/** Resolves `setProcessVariables` against the exact instance being migrated and writes each target through the value resolver (`pv:name`, or a nested `pv:/config/enabled`). Call it after the instance has migrated. */
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
        // The root execution is a read-only VariableScope, so resolvers can read `pv:` and the linked `doc:`.
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
            // The resolver routes each target by prefix, overwrites the variable and merges nested paths into its existing JSON.
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
