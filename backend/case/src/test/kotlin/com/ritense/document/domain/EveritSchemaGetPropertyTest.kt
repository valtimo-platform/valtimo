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

import com.ritense.document.domain.impl.JsonSchema
import java.net.URI
import org.assertj.core.api.Assertions.assertThat
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema
import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Test

class EveritSchemaGetPropertyTest {

    @Test
    fun `should resolve a nested property`() {
        val schema = schemaOf(
            """
            "properties": {
              "address": {
                "type": "object",
                "properties": {
                  "city": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.getProperty("/address/city")).isInstanceOf(StringSchema::class.java)
        assertThat(schema.allowsProperty("/address/city")).isTrue()
    }

    @Test
    fun `should resolve a property through a recursive reference`() {
        val schema = recursiveSchema()

        assertThat(schema.getProperty("/root/child/child/name")).isInstanceOf(StringSchema::class.java)
        assertThat(schema.allowsProperty("/root/child/child/name")).isTrue()
    }

    @Test
    fun `should resolve a property through a schema file that references itself`() {
        val schema = JsonSchema.fromResourceUri(
            URI.create("config/unit-test/document/definition/reference/recursive-person.schema.json")
        ).schema

        assertThat(schema.getProperty("/partner/children/0/partner/name")).isInstanceOf(StringSchema::class.java)
        assertThat(schema.allowsProperty("/partner/children/0/partner/name")).isTrue()
    }

    @Test
    fun `should stop resolving beyond the maximum schema depth instead of overflowing the stack`() {
        val schema = recursiveSchema()
        val tooDeep = "/root" + "/child".repeat(MAX_SCHEMA_DEPTH + 20) + "/name"

        assertThat(schema.getProperty(tooDeep)).isNull()
        assertDoesNotThrow { schema.allowsProperty(tooDeep) }
    }

    private fun recursiveSchema(): Schema = schemaOf(
        """
        "definitions": {
          "node": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "child": { "${'$'}ref": "#/definitions/node" }
            }
          }
        },
        "properties": {
          "root": { "${'$'}ref": "#/definitions/node" }
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
