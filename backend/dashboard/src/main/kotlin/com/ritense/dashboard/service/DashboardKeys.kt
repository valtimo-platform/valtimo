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

package com.ritense.dashboard.service

object DashboardKeys {

    // Unlike Constants.KEY_REGEX, allows a single letter — older dashboards have such keys
    const val PATTERN = "[a-z][a-z0-9_-]*"

    const val DASHBOARD_PREFIX = "dashboard"
    const val WIDGET_PREFIX = "widget"

    fun generate(title: String, fallbackPrefix: String = DASHBOARD_PREFIX, isTaken: (String) -> Boolean): String {
        val baseKey = slugify(title).ifEmpty { slugify("$fallbackPrefix $title") }
        var key = baseKey
        var i = 2
        while (isTaken(key)) {
            key = "${baseKey}_${i++}"
        }
        return key
    }

    fun slugify(text: String): String {
        return text
            .lowercase()
            .replace("(^[^a-z]+)|([^0-9a-z]+\$)".toRegex(), "") // trim start and end
            .replace("[^0-9a-z]+".toRegex(), "_") // replace all non-alphanumeric characters with '_'
    }
}
