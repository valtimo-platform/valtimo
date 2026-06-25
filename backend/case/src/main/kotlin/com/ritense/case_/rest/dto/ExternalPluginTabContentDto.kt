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

package com.ritense.case_.rest.dto

import java.util.UUID

/**
 * Content payload for an `EXTERNAL_PLUGIN` case tab. The frontend wrapper uses [bundleUrl] to render
 * the plugin iframe and [context] to seed the bundle (document + case-definition coordinates). The
 * iframe never receives a token — the wrapper mints a downscoped user token separately.
 */
data class ExternalPluginTabContentDto(
    val bundleUrl: String?,
    val configurationId: UUID,
    val bundleKey: String?,
    val context: ExternalPluginTabContext,
)

data class ExternalPluginTabContext(
    val documentId: String,
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val pluginConfigurationId: String,
)
