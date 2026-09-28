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

package com.ritense.externalplugin.compatibility

/**
 * Outcome of comparing a plugin's declared `compatibility` range against the running GZAC version.
 *
 * The platform only ever *warns* on incompatibility — it never blocks. [compatible] is therefore the
 * single signal the UI gates on; [status] explains why for messaging and logging. When the current
 * version cannot be determined the result is [compatible] = `true` with status
 * [CompatibilityStatus.CURRENT_VERSION_UNKNOWN], so an undeterminable version never surfaces a false
 * warning.
 */
data class CompatibilityResult(
    val compatible: Boolean,
    val currentGzacVersion: String?,
    val minGzacVersion: String?,
    val maxGzacVersion: String?,
    val status: CompatibilityStatus,
)

enum class CompatibilityStatus {
    COMPATIBLE,
    BELOW_MINIMUM,
    ABOVE_MAXIMUM,
    CURRENT_VERSION_UNKNOWN,
}
