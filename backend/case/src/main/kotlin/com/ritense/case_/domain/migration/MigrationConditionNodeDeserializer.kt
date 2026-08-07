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

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonDeserializer
import com.fasterxml.jackson.databind.JsonNode

/**
 * Reads a [MigrationConditionNode] from the shape of the JSON rather than from a type discriminator:
 * `allOf` and `anyOf` make it a group, anything else is a single condition. This keeps plan files (and
 * rows deployed before grouping existed) readable and unchanged — a condition is still just
 * `{"path": ..., "operator": ..., "value": ...}`.
 */
class MigrationConditionNodeDeserializer : JsonDeserializer<MigrationConditionNode>() {

    override fun deserialize(parser: JsonParser, context: DeserializationContext): MigrationConditionNode {
        val node = parser.readValueAsTree<JsonNode>()
        require(node.isObject) { "A migration condition must be a JSON object, but was '$node'" }

        return when {
            node.has(ALL_OF) -> parser.codec.treeToValue(node, AllOfMigrationCondition::class.java)
            node.has(ANY_OF) -> parser.codec.treeToValue(node, AnyOfMigrationCondition::class.java)
            node.has(PATH) -> parser.codec.treeToValue(node, MigrationCondition::class.java)
            else -> throw IllegalArgumentException(
                "A migration condition must have a '$PATH', or be a '$ALL_OF' or '$ANY_OF' group, but was '$node'"
            )
        }
    }

    private companion object {
        const val ALL_OF = "allOf"
        const val ANY_OF = "anyOf"
        const val PATH = "path"
    }
}
