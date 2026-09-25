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

package com.ritense.valtimo.contract.blueprint.migration

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper

/** A copy of [mapper] that refuses an unknown property instead of dropping it. Plan files are hand-written, so `sourse` has to fail rather than quietly turn a copy into a clear. The feature has to be enabled on the mapper: `@JsonIgnoreProperties(ignoreUnknown = false)` only declines to force-ignore and defers to exactly this flag, which the product's mapper disables. */
object MigrationComponentJson {

    fun strict(mapper: ObjectMapper): ObjectMapper =
        mapper.copy().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
}
