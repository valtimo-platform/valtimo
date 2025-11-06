/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.processlink.service

import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.springframework.stereotype.Component
import java.util.UUID

@Component
@SkipComponentScan
class DefaultBuildingBlockPluginConfigurationResolver : BuildingBlockPluginConfigurationResolver {

    override fun register(execution: DelegateExecution, mappings: Map<String, UUID>) {
        execution.setVariableLocal(PLUGIN_CONFIGURATION_MAPPINGS_VARIABLE, HashMap(mappings))
    }

    override fun resolve(execution: DelegateExecution, pluginDefinitionKey: String): UUID? {
        return findMappings(execution)[pluginDefinitionKey]
    }

    override fun resolve(task: DelegateTask, pluginDefinitionKey: String): UUID? {
        return resolve(task.execution, pluginDefinitionKey)
    }

    private fun findMappings(execution: DelegateExecution): Map<String, UUID> {
        return generateSequence(execution) { current -> current.superExecution }
            .mapNotNull { current ->
                val value = current.getVariableLocal(PLUGIN_CONFIGURATION_MAPPINGS_VARIABLE)
                @Suppress("UNCHECKED_CAST")
                value as? Map<String, UUID>
            }
            .firstOrNull()
            ?: emptyMap()
    }

    companion object {
        private const val PLUGIN_CONFIGURATION_MAPPINGS_VARIABLE = "buildBlockPluginConfigurationMappings"
    }
}
