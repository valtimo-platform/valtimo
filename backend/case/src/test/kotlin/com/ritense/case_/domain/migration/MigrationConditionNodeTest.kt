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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class MigrationConditionNodeTest {

    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `should read a flat list of conditions`() {
        val json = """
            [
                { "path": "case:internalStatus", "operator": "==", "value": "in-behandeling" },
                { "path": "doc:/dossier", "operator": "exists" }
            ]
        """.trimIndent()

        assertThat(read(json)).containsExactly(
            MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            MigrationCondition("doc:/dossier", "exists"),
        )
    }

    @Test
    fun `should read nested groups`() {
        val json = """
            [
                { "path": "case:internalStatus", "operator": "in", "value": ["in-behandeling", "wacht-op-klant"] },
                { "anyOf": [
                    { "path": "doc:/spoed", "operator": "==", "value": true },
                    { "allOf": [
                        { "path": "doc:/bedrag", "operator": ">=", "value": 1000 },
                        { "path": "doc:/dossier", "operator": "exists" }
                    ] }
                ] }
            ]
        """.trimIndent()

        assertThat(read(json)).containsExactly(
            MigrationCondition("case:internalStatus", "in", listOf("in-behandeling", "wacht-op-klant")),
            AnyOfMigrationCondition(
                listOf(
                    MigrationCondition("doc:/spoed", "==", true),
                    AllOfMigrationCondition(
                        listOf(
                            MigrationCondition("doc:/bedrag", ">=", 1000),
                            MigrationCondition("doc:/dossier", "exists"),
                        )
                    ),
                )
            ),
        )
    }

    @Test
    fun `should write groups back in the shape they were read`() {
        val json = """[{"anyOf":[{"path":"doc:/spoed","operator":"==","value":true},""" +
            """{"allOf":[{"path":"doc:/dossier","operator":"exists","value":null}]}]}]"""

        assertThat(objectMapper.writeValueAsString(read(json))).isEqualTo(json)
    }

    @Test
    fun `should fail on a condition that is neither a condition nor a group`() {
        assertThatThrownBy { read("""[{ "operator": "==", "value": "x" }]""") }
            .hasMessageContaining("must have a 'path', or be a 'allOf' or 'anyOf' group")
    }

    @Test
    fun `should fail on a condition that is not an object`() {
        assertThatThrownBy { read("""["case:internalStatus"]""") }
            .hasMessageContaining("must be a JSON object")
    }

    private fun read(json: String): List<MigrationConditionNode> =
        objectMapper.readValue(json, object : TypeReference<List<MigrationConditionNode>>() {})
}
