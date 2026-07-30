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

package com.ritense.processlink.web.rest.dto

import java.util.UUID

data class ProcessDefinitionImportPreviewResponseDto(
    val processDefinitionKeys: List<String>,
    /**
     * The processes of the package that already exist here and will be replaced by the import.
     */
    val existingProcessDefinitionKeys: List<String> = emptyList(),
    val pluginConfigurations: List<ProcessLinkPluginConfigurationPreviewDto> = emptyList(),
    val missingReferences: List<MissingReferenceDto> = emptyList(),
) {
    val canImport: Boolean get() = missingReferences.none { it.blocksImport }
}

/**
 * Mirrors the case import equivalent. Kept separate so the process-link module does not depend on
 * the case module's REST contract.
 */
data class ProcessLinkPluginConfigurationPreviewDto(
    val pluginConfigurationId: UUID,
    val pluginDefinitionKey: String?,
    val pluginActionDefinitionKey: String,
    val processDefinitionKey: String,
    val activityId: String,
    val existsInTargetEnvironment: Boolean,
)
