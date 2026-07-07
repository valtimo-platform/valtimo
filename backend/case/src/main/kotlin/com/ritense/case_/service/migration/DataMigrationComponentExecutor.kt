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
import com.ritense.case_.repository.DataMigrationConfigurationRepository
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentExecutor
import com.ritense.valueresolver.ValueResolverService
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

/**
 * Executes the `dataMigration` component for a single case using value resolvers only:
 * `resolveValues` reads the source paths and `handleValues` writes the target paths against the
 * case document. Reading/writing the document itself is delegated to the [ValueResolverService],
 * so this executor never touches the document store directly. Runs in the caller's transaction.
 */
@Transactional
class DataMigrationComponentExecutor(
    private val objectMapper: ObjectMapper,
    private val dataMigrationConfigurationRepository: DataMigrationConfigurationRepository,
    private val valueResolverService: ValueResolverService,
) : MigrationComponentExecutor {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: CaseDefinitionMigrationId, caseId: UUID) {
        val patches = dataMigrationConfigurationRepository.findById(migrationId).getOrNull()?.patches
        if (patches.isNullOrEmpty()) {
            return
        }

        val sourcePaths = patches.mapNotNull { it.source }.distinct()
        val resolvedSources = if (sourcePaths.isEmpty()) {
            emptyMap()
        } else {
            valueResolverService.resolveValues(caseId.toString(), sourcePaths)
        }

        // key = target value-resolver path (e.g. "doc:/contact/voornaam"), value = coerced value
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
            valueResolverService.handleValues(caseId, targetValues)
        }
    }

    /**
     * Coerces a value for its target. With an explicit [targetType] the value is converted to that
     * type; without one the value is written as-is (keeping the type it was resolved/deserialized
     * as).
     */
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
