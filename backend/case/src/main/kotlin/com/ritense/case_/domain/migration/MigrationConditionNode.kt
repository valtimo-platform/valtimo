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

/** One entry in a plan's `conditions`: a single [MigrationCondition], or an [AllOfMigrationCondition] / [AnyOfMigrationCondition] group. The top-level list is itself AND-combined, so the flat form still works. */
@JsonDeserialize(using = MigrationConditionNodeDeserializer::class)
sealed interface MigrationConditionNode

/** A group that holds when *all* of its [allOf] entries hold. */
// @JsonDeserialize is switched off, or deserializing would loop back into the deserializer that produced it.
@JsonDeserialize(using = JsonDeserializer.None::class)
data class AllOfMigrationCondition(
    val allOf: List<MigrationConditionNode>,
) : MigrationConditionNode

/** A group that holds when *any* of its [anyOf] entries holds. */
@JsonDeserialize(using = JsonDeserializer.None::class)
data class AnyOfMigrationCondition(
    val anyOf: List<MigrationConditionNode>,
) : MigrationConditionNode
