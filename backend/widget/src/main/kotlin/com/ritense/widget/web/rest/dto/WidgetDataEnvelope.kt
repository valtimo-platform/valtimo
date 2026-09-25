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

package com.ritense.widget.web.rest.dto

import com.fasterxml.jackson.annotation.JsonInclude

/** One widget's slot in a bundled response. Failure is explicit, so it cannot read as empty data. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class WidgetDataEnvelope(
    val data: Any? = null,
    val error: WidgetDataError? = null,
) {
    companion object {
        fun of(data: Any?) = WidgetDataEnvelope(data = data)

        fun failed() = WidgetDataEnvelope(error = WidgetDataError(UPSTREAM_UNAVAILABLE))

        const val UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    }
}

@JsonInclude(JsonInclude.Include.NON_NULL)
data class WidgetDataError(
    val code: String,
)
