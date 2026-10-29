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
 * `case-widget` bundle. Declared here (in `case`) so the dependency stays one-directional
 * (external-plugin → case, no cycle) while the widget-data endpoint can still hand the frontend a
 * resolved `bundleUrl`. The sibling of [ExternalPluginCaseTabResolver] for the widget surface;
 * reuses [ExternalPluginTabDefinition] for the design-time plugin identity.
 *
 * The case module consumes this as an `Optional` so it builds and runs without the external-plugin
 * module on the classpath.
 */
interface ExternalPluginCaseWidgetResolver {

    /**
     * Resolves the absolute URL of the plugin configuration's `case-widget` bundle, or `null` if the
     * configuration/definition/bundle cannot be found.
     *
     * @param configurationId the external-plugin configuration backing the widget
     * @param bundleKey the bundle key when the plugin ships more than one `case-widget` bundle;
     *   `null` selects the sole `case-widget` bundle
     */
    fun resolveBundleUrl(configurationId: UUID, bundleKey: String?): String?

    /**
     * Resolves the plugin definition (`pluginId` + version) backing the configuration, or `null`
     * when the configuration/definition can no longer be found. Used at export time so a
     * `case-widget` export is self-describing: the widget stores only the configuration id, so
     * embedding the resolved definition lets the import preview identify the plugin even when the
     * referenced configuration was deleted in the target environment.
     */
    fun resolvePluginDefinition(configurationId: UUID): ExternalPluginTabDefinition?
}
