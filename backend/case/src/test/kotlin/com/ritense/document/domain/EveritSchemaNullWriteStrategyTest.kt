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

package com.ritense.document.domain

import com.ritense.document.domain.NullWriteStrategy.NOT_ALLOWED
import com.ritense.document.domain.NullWriteStrategy.REMOVE
import com.ritense.document.domain.NullWriteStrategy.WRITE_NULL
import com.ritense.document.domain.impl.JsonSchema
import org.assertj.core.api.Assertions.assertThat
import org.everit.json.schema.Schema
import org.junit.jupiter.api.Test

class EveritSchemaNullWriteStrategyTest {

    @Test
    fun `should write null when the type explicitly allows null`() {
        val schema = schemaOf(
            """
            "properties": {
              "middleName": { "type": ["string", "null"] }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/middleName")).isEqualTo(WRITE_NULL)
    }

    @Test
    fun `should write null when a combined schema allows null`() {
        val schema = schemaOf(
            """
            "properties": {
              "middleName": {
                "anyOf": [
                  { "type": "string" },
                  { "type": "null" }
                ]
              }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/middleName")).isEqualTo(WRITE_NULL)
    }

    @Test
    fun `should write null when the schema places no constraint on the value`() {
        val schema = schemaOf(
            """
            "properties": {
              "anything": {}
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/anything")).isEqualTo(WRITE_NULL)
    }

    @Test
    fun `should remove when null is not allowed but the property is optional`() {
        val schema = schemaOf(
            """
            "properties": {
              "firstName": { "type": "string" }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/firstName")).isEqualTo(REMOVE)
    }

    @Test
    fun `should not allow when null is not allowed and the property is required`() {
        val schema = schemaOf(
            """
            "required": ["firstName"],
            "properties": {
              "firstName": { "type": "string" }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/firstName")).isEqualTo(NOT_ALLOWED)
    }

    @Test
    fun `should evaluate the parent required list for a nested optional property`() {
        val schema = schemaOf(
            """
            "properties": {
              "address": {
                "type": "object",
                "required": ["city"],
                "properties": {
                  "street": { "type": "string" },
                  "city": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/address/street")).isEqualTo(REMOVE)
        assertThat(schema.determineNullWriteStrategy("/address/city")).isEqualTo(NOT_ALLOWED)
    }

    @Test
    fun `should write null for a nested property whose type allows null`() {
        val schema = schemaOf(
            """
            "properties": {
              "address": {
                "type": "object",
                "required": ["city"],
                "properties": {
                  "city": { "type": ["string", "null"] }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/address/city")).isEqualTo(WRITE_NULL)
    }

    private fun schemaOf(properties: String): Schema =
        JsonSchema.fromString(
            """
            {
              "${'$'}id": "test.schema",
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              $properties
            }
            """.trimIndent()
        ).schema
}
