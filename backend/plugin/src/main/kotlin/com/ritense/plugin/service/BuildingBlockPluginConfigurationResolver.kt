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

package com.ritense.plugin.service

import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import java.util.UUID

interface BuildingBlockPluginConfigurationResolver {
    fun resolve(execution: DelegateExecution, pluginDefinitionKey: String): UUID?
    fun resolve(task: DelegateTask, pluginDefinitionKey: String): UUID?

    /**
     * Resolves the configuration id for the first `pluginConfigurationMappings` key that starts with
     * [keyPrefix], or `null` when none matches. Lets a caller resolve version-tolerantly: the
     * external-plugin system keys building-block mappings as `external-plugin:<pluginId>@<version>`,
     * so a prefix of `external-plugin:<pluginId>@` matches a mapping made for a *different* version of
     * the same plugin (the resolved configuration's version then applies at runtime — D1). Callers try
     * the exact key first and fall back to this. Default no-op for resolvers that don't support it.
     */
    fun resolveByKeyPrefix(execution: DelegateExecution, keyPrefix: String): UUID? = null
}
