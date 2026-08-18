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

package com.ritense.case_.service

import java.util.UUID

/**
 * SPI implemented by the external-plugin module to resolve the absolute bundle URL for a plugin's
 * `case-tab` bundle. Declared here (in `case`) so the dependency stays one-directional
 * (external-plugin → case, no cycle) while the case content endpoint can still hand the frontend a
 * resolved `bundleUrl`.
 *
 * The case module consumes this as an `Optional`/`ObjectProvider` so it builds and runs without the
 * external-plugin module on the classpath.
 */
interface ExternalPluginCaseTabResolver {

    /**
     * Resolves the absolute URL of the plugin configuration's `case-tab` bundle, or `null` if the
     * configuration/definition/bundle cannot be found.
     *
     * @param configurationId the external-plugin configuration backing the tab
     * @param bundleKey the bundle key when the plugin ships more than one `case-tab` bundle; `null`
     *   selects the sole `case-tab` bundle
     */
    fun resolveBundleUrl(configurationId: UUID, bundleKey: String?): String?

    /**
     * Resolves the plugin definition (`pluginId` + version) backing the configuration, or `null`
     * when the configuration/definition can no longer be found. Used at export time so a `case-tab`
     * export is self-describing: unlike a process link (whose export already carries its plugin
     * key/version), a tab's `contentKey` holds only the configuration id. Embedding the resolved
     * definition lets the import preview identify the plugin even when the referenced configuration
     * was deleted in the target environment (otherwise the tab is an unidentifiable, unmappable row).
     */
    fun resolvePluginDefinition(configurationId: UUID): ExternalPluginTabDefinition?
}

/**
 * Design-time plugin identity of an `EXTERNAL_PLUGIN` case tab, embedded in the tab export so the
 * import preview can identify the plugin without resolving the (possibly-deleted) configuration.
 */
data class ExternalPluginTabDefinition(
    val pluginDefinitionKey: String,
    val pluginDefinitionVersion: String,
)
