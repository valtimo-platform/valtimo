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
 * One entry in a migration plan's `conditions`: either a single [MigrationCondition] or a group that
 * combines nested entries with AND ([AllOfMigrationCondition]) or OR ([AnyOfMigrationCondition]).
 * Groups may nest freely, so arbitrary boolean expressions can be expressed.
 *
 * A plan's top-level `conditions` list is itself AND-combined, which keeps the flat form (a plain
 * list of conditions, no groups) working exactly as it always has:
 *
 * ```json
 * "conditions": [
 *   { "path": "case:internalStatus", "operator": "in", "value": "in-behandeling,wacht-op-klant" },
 *   { "anyOf": [
 *       { "path": "doc:/spoed", "operator": "==", "value": true },
 *       { "allOf": [
 *           { "path": "doc:/bedrag", "operator": ">=", "value": 1000 },
 *           { "path": "doc:/dossier", "operator": "exists" }
 *       ] }
 *   ] }
 * ]
 * ```
 */
@JsonDeserialize(using = MigrationConditionNodeDeserializer::class)
sealed interface MigrationConditionNode

/** A group that holds when *all* of its [allOf] entries hold. */
// The inherited @JsonDeserialize is switched off, otherwise deserializing this type would loop back
// into the deserializer that produced it.
@JsonDeserialize(using = JsonDeserializer.None::class)
data class AllOfMigrationCondition(
    val allOf: List<MigrationConditionNode>,
) : MigrationConditionNode

/** A group that holds when *any* of its [anyOf] entries holds. */
@JsonDeserialize(using = JsonDeserializer.None::class)
data class AnyOfMigrationCondition(
    val anyOf: List<MigrationConditionNode>,
) : MigrationConditionNode
