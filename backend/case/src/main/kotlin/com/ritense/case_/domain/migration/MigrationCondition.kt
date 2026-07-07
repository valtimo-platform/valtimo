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

package com.ritense.case_.domain.migration

/**
 * A condition that gates whether a migration plan may run for a given case. A triggered plan
 * waits until all of its conditions hold.
 *
 * @param path a value-resolver path evaluated against the case, e.g. `case:internalStatus`.
 * @param operator the comparison operator, e.g. `==`.
 * @param value the value to compare against.
 */
data class MigrationCondition(
    val path: String,
    val operator: String,
    val value: Any? = null,
)
