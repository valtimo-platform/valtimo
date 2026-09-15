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

package com.ritense.valtimo.contract.conditions

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.core.ObjectCodec
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.deser.std.StdDeserializer
import com.fasterxml.jackson.databind.exc.MismatchedInputException
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode

/**
 * Deserializes a [ConditionNode] by sniffing the JSON shape:
 * - an object with an `and` array becomes an [AndConditionGroup],
 * - an object with an `or` array becomes an [OrConditionGroup],
 * - any other object is delegated to [Condition]'s regular bean deserializer, so all leaf
 *   aliases (`queryPath`/`queryOperator`/`queryValue`) and SpEL `value` handling keep working.
 *
 * Empty groups are rejected at parse time: `cb.or()` with zero predicates evaluates to `false`,
 * which would silently zero out counts.
 */
class ConditionNodeDeserializer : StdDeserializer<ConditionNode>(ConditionNode::class.java) {

    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): ConditionNode {
        val codec = p.codec
        val node = codec.readTree<JsonNode>(p)
        return toConditionNode(node, codec, ctxt)
    }

    private fun toConditionNode(node: JsonNode, codec: ObjectCodec, ctxt: DeserializationContext): ConditionNode {
        if (node !is ObjectNode) {
            throw MismatchedInputException.from(ctxt.parser, ConditionNode::class.java, "Expected a condition object")
        }
        val hasAnd = node.has(AND)
        val hasOr = node.has(OR)
        return when {
            hasAnd && hasOr -> throw MismatchedInputException.from(
                ctxt.parser, ConditionNode::class.java, "A condition group cannot contain both 'and' and 'or'"
            )
            hasAnd -> AndConditionGroup(childNodes(node, AND, codec, ctxt))
            hasOr -> OrConditionGroup(childNodes(node, OR, codec, ctxt))
            else -> codec.treeToValue(node, Condition::class.java)
        }
    }

    private fun childNodes(
        node: ObjectNode,
        field: String,
        codec: ObjectCodec,
        ctxt: DeserializationContext
    ): List<ConditionNode> {
        val children = node.get(field)
        if (children !is ArrayNode || children.isEmpty) {
            throw MismatchedInputException.from(
                ctxt.parser, ConditionNode::class.java, "Condition group '$field' must be a non-empty array"
            )
        }
        return children.map { toConditionNode(it, codec, ctxt) }
    }

    companion object {
        private const val AND = "and"
        private const val OR = "or"
    }
}
