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

package com.ritense.iko.web.rest.request

import com.ritense.tab.domain.Tab
import com.ritense.tab.domain.WidgetLayout
import jakarta.validation.constraints.Size

data class IkoTabCreateRequest(
    @field:Size(max = 256)
    val title: String?,
    @field:Size(max = 256)
    val type: String,
    val properties: Map<String, Any?> = emptyMap(),
    val widgetLayout: WidgetLayout? = null,
) {
    fun toEntity(key: String) = Tab(
        key = key,
        title = title,
        order = 0,
        type = type,
        properties = properties,
        widgetLayout = widgetLayout,
    )
}