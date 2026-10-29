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

package com.ritense.valtimo.contract.plugin

import java.util.UUID

/**
 * SPI reporting where the application menu places an external-plugin `page` bundle that references a
 * plugin configuration. Implemented by the `admin-settings` module, which owns the persisted menu
 * structure; consumed by the plugin systems' delete guards so a configuration backing a live menu
 * page cannot be deleted out from under it. Lives in `contract` because `admin-settings` depends on
 * neither plugin module and vice versa.
 */
interface MenuPagePluginUsageFinder {
    fun findUsages(configurationId: UUID): List<MenuPagePluginUsage>
}

/** One `plugin-page` menu node referencing the configuration. */
data class MenuPagePluginUsage(
    val configurationId: UUID,
    val title: String?,
    val bundleKey: String?,
)
