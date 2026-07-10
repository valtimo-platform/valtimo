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

package com.ritense.externalplugin.web.rest.dto

import java.util.UUID

/**
 * One activated external-plugin `page` bundle that an admin can place in the menu. There is no role
 * field: access is enforced by PBAC at render time (the page route mints a downscoped user token).
 * [titleTranslations] holds the per-locale title resolved from the manifest's `translations` block
 * for [title] (which may itself be a translation key or a literal); the frontend localizes from it,
 * falling back to [title] and then [configurationTitle].
 */
data class ExternalPluginMenuPageDto(
    val configurationId: UUID,
    val configurationTitle: String,
    val bundleKey: String?,
    val bundleUrl: String?,
    val title: String?,
    val titleTranslations: Map<String, String>,
    val icon: String?,
)
