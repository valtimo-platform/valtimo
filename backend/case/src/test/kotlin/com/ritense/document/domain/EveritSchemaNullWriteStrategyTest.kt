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
    fun `should not let the order of oneOf branches decide whether a property can be cleared`() {
        // A document that drops `v` still validates against the branch that does not require it, so it can
        // go. Reading only the first object branch made the answer NOT_ALLOWED or REMOVE depending on which
        // branch the author wrote first.
        val requiredFirst = combinedParentOf(
            """{ "type": "object", "required": ["v"], "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "v": { "type": "string" } } }""",
            criterion = "oneOf",
        )
        val optionalFirst = combinedParentOf(
            """{ "type": "object", "properties": { "v": { "type": "string" } } },
               { "type": "object", "required": ["v"], "properties": { "v": { "type": "string" } } }""",
            criterion = "oneOf",
        )

        assertThat(requiredFirst.determineNullWriteStrategy("/p/v")).isEqualTo(REMOVE)
        assertThat(optionalFirst.determineNullWriteStrategy("/p/v")).isEqualTo(REMOVE)
    }

    @Test
    fun `should refuse to clear a property an allOf requires in any of its branches`() {
        // Under allOf the value has to satisfy every branch, so one branch requiring the property is enough
        // to keep it — the opposite rule to anyOf/oneOf, and the same one validation applies.
        val schema = combinedParentOf(
            """{ "type": "object", "required": ["v"], "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "v": { "type": "string" } } }""",
            criterion = "allOf",
        )

        assertThat(schema.determineNullWriteStrategy("/p/v")).isEqualTo(NOT_ALLOWED)
    }

    @Test
    fun `should refuse to clear a property every oneOf branch requires`() {
        val schema = combinedParentOf(
            """{ "type": "object", "required": ["v"], "properties": { "v": { "type": "string" } } },
               { "type": "object", "required": ["v"], "properties": { "v": { "type": "number" } } }""",
            criterion = "oneOf",
        )

        assertThat(schema.determineNullWriteStrategy("/p/v")).isEqualTo(NOT_ALLOWED)
    }

    @Test
    fun `should clear an optional property of an array element`() {
        // The parent of `/items/0/value` is the item schema, which the pointer walk could not resolve at all
        // until it learned to answer a pointer that stops at an index — and an unresolvable parent is
        // reported as NOT_ALLOWED, whatever its required list says.
        val schema = schemaOf(
            """
            "properties": {
              "items": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["id"],
                  "properties": { "id": { "type": "string" }, "value": { "type": "string" } }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/items/0/value")).isEqualTo(REMOVE)
        assertThat(schema.determineNullWriteStrategy("/items/0/id")).isEqualTo(NOT_ALLOWED)
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

    @Test
    fun `should determine a strategy for a recursive schema without overflowing the stack`() {
        val schema = schemaOf(
            """
            "definitions": {
              "node": {
                "type": "object",
                "required": ["name"],
                "properties": {
                  "name": { "type": "string" },
                  "nickname": { "type": "string" },
                  "child": { "${'$'}ref": "#/definitions/node" }
                }
              }
            },
            "properties": {
              "root": { "${'$'}ref": "#/definitions/node" }
            }
            """.trimIndent()
        )

        assertThat(schema.determineNullWriteStrategy("/root/child/nickname")).isEqualTo(REMOVE)
        assertThat(schema.determineNullWriteStrategy("/root/child/name")).isEqualTo(NOT_ALLOWED)
    }

    /** A root with one property `p` whose schema combines the given branches under [criterion]. */
    private fun combinedParentOf(branches: String, criterion: String): Schema = schemaOf(
        """
        "properties": {
          "p": { "$criterion": [$branches] }
        }
        """.trimIndent()
    )

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
