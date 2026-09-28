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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.exc.MismatchedInputException
import com.fasterxml.jackson.databind.module.SimpleModule
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.repository.ExpressionOperator
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class ConditionNodeDeserializerTest {

    private val mapper: ObjectMapper = MapperSingleton.get().copy().registerModule(
        SimpleModule().addDeserializer(ConditionNode::class.java, ConditionNodeDeserializer())
    )

    private fun readNode(json: String): ConditionNode = mapper.readValue(json, ConditionNode::class.java)

    private fun readNodes(json: String): List<ConditionNode> =
        mapper.readValue(json, object : TypeReference<List<ConditionNode>>() {})

    @Test
    fun `should deserialize flat leaf with canonical keys as a Condition`() {
        val node = readNode(
            """
            {"path": "task:assignee", "operator": "!=", "value": "x"}
            """.trimIndent()
        )

        assertThat(node).isInstanceOf(Condition::class.java)
        val condition = node as Condition<*>
        assertThat(condition.path).isEqualTo("task:assignee")
        assertThat(condition.operator).isEqualTo(ExpressionOperator.NOT_EQUAL_TO)
        assertThat(condition.value).isEqualTo("x")
    }

    @Test
    fun `should deserialize legacy alias leaf as a Condition`() {
        val node = readNode(
            """
            {"queryPath": "task:name", "queryOperator": "==", "queryValue": "Beoordeel"}
            """.trimIndent()
        )

        assertThat(node).isInstanceOf(Condition::class.java)
        val condition = node as Condition<*>
        assertThat(condition.path).isEqualTo("task:name")
        assertThat(condition.operator).isEqualTo(ExpressionOperator.EQUAL_TO)
        assertThat(condition.value).isEqualTo("Beoordeel")
    }

    @Test
    fun `should deserialize an or group with two Condition children`() {
        val node = readNode(
            """
            {"or": [
                {"path": "task:name", "operator": "==", "value": "A"},
                {"path": "task:name", "operator": "==", "value": "B"}
            ]}
            """.trimIndent()
        )

        assertThat(node).isInstanceOf(OrConditionGroup::class.java)
        val group = node as OrConditionGroup
        assertThat(group.or).hasSize(2)
        assertThat(group.or).allMatch { it is Condition<*> }
    }

    @Test
    fun `should deserialize a nested and-or tree`() {
        val node = readNode(
            """
            {"and": [
                {"path": "task:assignee", "operator": "!=", "value": "x"},
                {"or": [
                    {"path": "task:name", "operator": "==", "value": "A"},
                    {"path": "task:name", "operator": "==", "value": "B"}
                ]}
            ]}
            """.trimIndent()
        )

        assertThat(node).isInstanceOf(AndConditionGroup::class.java)
        val group = node as AndConditionGroup
        assertThat(group.and).hasSize(2)
        assertThat(group.and[0]).isInstanceOf(Condition::class.java)
        assertThat(group.and[1]).isInstanceOf(OrConditionGroup::class.java)
        assertThat((group.and[1] as OrConditionGroup).or).hasSize(2)
    }

    @Test
    fun `should deserialize a leaf with array value and in operator as a ComparableList`() {
        val node = readNode(
            """
            {"path": "task:name", "operator": "in", "value": ["A", "B"]}
            """.trimIndent()
        )

        assertThat(node).isInstanceOf(Condition::class.java)
        val condition = node as Condition<*>
        assertThat(condition.operator).isEqualTo(ExpressionOperator.IN)
        assertThat(condition.value).isInstanceOf(ComparableList::class.java)
        assertThat((condition.value as ComparableList).toList()).containsExactly("A", "B")
    }

    @Test
    fun `should deserialize a top-level list of nodes combined with implicit AND`() {
        val nodes = readNodes(
            """
            [
                {"path": "task:assignee", "operator": "!=", "value": "x"},
                {"or": [
                    {"path": "task:name", "operator": "==", "value": "A"},
                    {"path": "task:name", "operator": "==", "value": "B"}
                ]}
            ]
            """.trimIndent()
        )

        assertThat(nodes).hasSize(2)
        assertThat(nodes[0]).isInstanceOf(Condition::class.java)
        assertThat(nodes[1]).isInstanceOf(OrConditionGroup::class.java)
    }

    @Test
    fun `should reject a group containing both and and or`() {
        assertThrows<MismatchedInputException> {
            readNode(
                """
                {"and": [{"path": "a", "operator": "==", "value": "1"}],
                 "or": [{"path": "b", "operator": "==", "value": "2"}]}
                """.trimIndent()
            )
        }
    }

    @Test
    fun `should reject an empty group`() {
        assertThrows<MismatchedInputException> {
            readNode("""{"or": []}""")
        }
    }

    @Test
    fun `should reject a non-object node element`() {
        assertThrows<MismatchedInputException> {
            readNode("""{"or": ["not-an-object"]}""")
        }
    }

    @Test
    fun `should round-trip a Condition to canonical keys without leaking extra fields`() {
        val condition = Condition("task:name", ExpressionOperator.EQUAL_TO, "A")

        val json = mapper.writeValueAsString(condition)
        val tree = mapper.readTree(json)

        assertThat(tree.fieldNames().asSequence().toList())
            .containsExactlyInAnyOrder("path", "operator", "value")
        assertThat(tree.get("path").asText()).isEqualTo("task:name")
        assertThat(tree.get("operator").asText()).isEqualTo("==")
        assertThat(tree.get("value").asText()).isEqualTo("A")
    }
}
