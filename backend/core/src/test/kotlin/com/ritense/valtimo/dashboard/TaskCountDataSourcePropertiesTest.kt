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

package com.ritense.valtimo.dashboard

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.conditions.OrConditionGroup
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.repository.ExpressionOperator
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class TaskCountDataSourcePropertiesTest {

    private val mapper: ObjectMapper = MapperSingleton.get()

    private fun read(json: String): TaskCountDataSourceProperties =
        mapper.readValue(json, TaskCountDataSourceProperties::class.java)

    @Test
    fun `should deserialize legacy queryConditions with leaf aliases`() {
        val properties = read(
            """
            {"queryConditions":[{"queryPath":"task:assignee","queryOperator":"==","queryValue":"x"}]}
            """.trimIndent()
        )

        assertThat(properties.caseDefinitionName).isNull()
        assertThat(properties.conditions).hasSize(1)
        val condition = properties.conditions!![0] as Condition<*>
        assertThat(condition.path).isEqualTo("task:assignee")
        assertThat(condition.operator).isEqualTo(ExpressionOperator.EQUAL_TO)
        assertThat(condition.value).isEqualTo("x")
    }

    @Test
    fun `should deserialize current conditions with canonical keys`() {
        val properties = read(
            """
            {"conditions":[{"path":"task:name","operator":"!=","value":"x"}]}
            """.trimIndent()
        )

        assertThat(properties.caseDefinitionName).isNull()
        assertThat(properties.conditions).hasSize(1)
        assertThat(properties.conditions!![0]).isInstanceOf(Condition::class.java)
    }

    @Test
    fun `should deserialize caseDefinitionName with a leaf and an or-group`() {
        val properties = read(
            """
            {
                "caseDefinitionName":"leerlingzaken",
                "conditions":[
                    {"path":"task:assignee","operator":"!=","value":"x"},
                    {"or":[
                        {"path":"task:name","operator":"==","value":"A"},
                        {"path":"task:name","operator":"==","value":"B"}
                    ]}
                ]
            }
            """.trimIndent()
        )

        assertThat(properties.caseDefinitionName).isEqualTo("leerlingzaken")
        assertThat(properties.conditions).hasSize(2)
        assertThat(properties.conditions!![0]).isInstanceOf(Condition::class.java)
        assertThat(properties.conditions!![1]).isInstanceOf(OrConditionGroup::class.java)
        assertThat((properties.conditions!![1] as OrConditionGroup).or).hasSize(2)
    }

    @Test
    fun `should default absent conditions to empty list and absent caseDefinitionName to null`() {
        val properties = read("{}")

        assertThat(properties.caseDefinitionName).isNull()
        assertThat(properties.conditions).isEmpty()
    }
}
