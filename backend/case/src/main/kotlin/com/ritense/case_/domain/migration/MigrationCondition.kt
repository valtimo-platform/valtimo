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

import com.fasterxml.jackson.databind.JsonDeserializer
import com.fasterxml.jackson.databind.annotation.JsonDeserialize

/**
 * A single condition that gates whether a migration plan may run for a given case. A triggered plan
 * waits until its conditions hold. Conditions can be combined with AND/OR groups — see
 * [MigrationConditionNode].
 *
 * @param path a value-resolver path evaluated against the case, e.g. `case:internalStatus`.
 * @param operator the comparison operator: `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `contains` or
 * `exists`. See `MigrationConditionEvaluator` for their semantics.
 * @param value the value to compare against. A list (or comma-separated string) for `in`, optional
 * for `exists`.
 */
// The inherited @JsonDeserialize is switched off, otherwise deserializing this type would loop back
// into the deserializer that produced it.
@JsonDeserialize(using = JsonDeserializer.None::class)
data class MigrationCondition(
    val path: String,
    val operator: String,
    val value: Any? = null,
) : MigrationConditionNode
