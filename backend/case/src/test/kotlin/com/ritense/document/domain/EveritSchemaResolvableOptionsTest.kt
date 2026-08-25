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
import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionType.COLLECTION
import com.ritense.valueresolver.ValueResolverOptionType.FIELD
import java.net.URI
import org.assertj.core.api.Assertions.assertThat
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema
import org.junit.jupiter.api.Test

class EveritSchemaResolvableOptionsTest {

    @Test
    fun `should return leaf fields for a flat schema`() {
        val options = schemaOf(
            """
            "properties": {
              "firstName": { "type": "string" },
              "lastName": { "type": "string" }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path to it.type }).containsExactlyInAnyOrder(
            "doc:/firstName" to FIELD,
            "doc:/lastName" to FIELD
        )
    }

    @Test
    fun `should include the object node itself alongside its leaf properties`() {
        val options = schemaOf(
            """
            "properties": {
              "applicantName": { "type": "string" },
              "applicantAddress": {
                "type": "object",
                "properties": {
                  "city": { "type": "string" },
                  "postalCode": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path to it.type }).containsExactlyInAnyOrder(
            "doc:/applicantName" to FIELD,
            // the object container node is now selectable, so a whole subtree can be resolved at once
            "doc:/applicantAddress" to FIELD,
            "doc:/applicantAddress/city" to FIELD,
            "doc:/applicantAddress/postalCode" to FIELD
        )
    }

    @Test
    fun `should include every object node in a deeply nested schema`() {
        val options = schemaOf(
            """
            "properties": {
              "applicant": {
                "type": "object",
                "properties": {
                  "address": {
                    "type": "object",
                    "properties": {
                      "city": { "type": "string" }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path }).containsExactlyInAnyOrder(
            "doc:/applicant",
            "doc:/applicant/address",
            "doc:/applicant/address/city"
        )
    }

    @Test
    fun `should not emit an option for the root object`() {
        val options = schemaOf(
            """
            "properties": {
              "name": { "type": "string" }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path }).doesNotContain("doc:", "doc:/")
    }

    @Test
    fun `should expose an array as both a collection and a field option`() {
        // Two options at one path, on purpose: getResolvableKeys filters by the requested type, so the
        // collection widget sees the iterable and every field-typed picker sees the container. Without
        // the FIELD half an array was unreachable from every field picker in the application.
        val options = schemaOf(
            """
            "properties": {
              "tags": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path to it.type }).containsExactlyInAnyOrder(
            "doc:/tags" to FIELD,
            "doc:/tags" to COLLECTION
        )
        // Only the collection half carries the item fields; the container resolves to the array itself.
        assertThat(options.single { it.type == COLLECTION }.children).isNotEmpty()
        assertThat(options.single { it.type == FIELD }.children).isNull()
    }

    @Test
    fun `should expose an array nested inside an object, and the objects inside its items`() {
        val options = schemaOf(
            """
            "properties": {
              "applicant": {
                "type": "object",
                "properties": {
                  "children": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "name": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.filter { it.type == FIELD }.map { it.path }).containsExactlyInAnyOrder(
            "doc:/applicant",
            "doc:/applicant/children"
        )
        // The item fields stay inside the collection option, keyed relative to the array.
        val collection = options.single { it.type == COLLECTION }
        assertThat(collection.path).isEqualTo("doc:/applicant/children")
        assertThat(collection.children?.map { it.path }).contains("/name")
    }

    @Test
    fun `should keep both answers for a node that is either a list or a single value`() {
        // Deduplicating by path alone let the branch the author happened to write first decide whether such
        // a node was a field or a collection. Asserted in both declaration orders, since that is exactly
        // what used to change the answer.
        listOf(
            """{ "type": "array", "items": { "type": "string" } }, { "type": "string" }""",
            """{ "type": "string" }, { "type": "array", "items": { "type": "string" } }""",
        ).forEach { branches ->
            val options = schemaOf(
                """
                "properties": {
                  "incomeTypes": { "oneOf": [$branches] }
                }
                """.trimIndent()
            ).collectValueResolverOptions("doc:")

            assertThat(options.map { it.path to it.type }).containsExactlyInAnyOrder(
                "doc:/incomeTypes" to FIELD,
                "doc:/incomeTypes" to COLLECTION
            )
        }
    }

    @Test
    fun `should keep both answers for a node declared with a list of types`() {
        // `type: ["array", "string"]` is loaded as an anyOf of one schema per type, so it takes the same path.
        val options = schemaOf(
            """
            "properties": {
              "incomeTypes": { "type": ["array", "string"], "items": { "type": "string" } }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path to it.type }).containsExactlyInAnyOrder(
            "doc:/incomeTypes" to FIELD,
            "doc:/incomeTypes" to COLLECTION
        )
    }

    @Test
    fun `should still collapse two branches that describe the same field`() {
        val options = schemaOf(
            """
            "properties": {
              "reference": {
                "oneOf": [
                  { "type": "string", "minLength": 1 },
                  { "type": "string", "maxLength": 9 }
                ]
              }
            }
            """.trimIndent()
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path to it.type }).containsExactly("doc:/reference" to FIELD)
    }

    @Test
    fun `should stop following a recursive reference instead of overflowing the stack`() {
        val options = schemaOf(
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
        ).collectValueResolverOptions("doc:")

        assertThat(options.map { it.path }).contains("doc:/root", "doc:/root/name")
        // the recursion is cut off, so the options do not grow unbounded
        assertThat(options).hasSizeLessThan(10)
    }

    @Test
    fun `should not endlessly expand a schema file that references itself`() {
        // a person has a partner who is a person, and children who are persons: a legitimate but unbounded model
        val options = JsonSchema.fromResourceUri(
            URI.create("config/unit-test/document/definition/reference/recursive-person.schema.json")
        ).schema.collectValueResolverOptions("doc:")

        assertThat(options.map { it.path }).contains(
            "doc:/name",
            "doc:/partner",
            "doc:/partner/name",
            "doc:/partner/address/street",
            "doc:/children"
        )
        // each reference is expanded at most once per path, so the person cycle cannot grow the option tree unbounded
        assertThat(options.map { it.path }).allMatch { path -> path.split("/partner").size - 1 <= 2 }
        assertThat(countOptions(options)).isLessThan(100)
    }

    @Test
    fun `should stop collecting options beyond the maximum schema depth`() {
        val options = nestedObjectSchema(MAX_SCHEMA_DEPTH + 20).collectValueResolverOptions("doc:")

        val deepestOption = options.maxOf { option -> option.path.count { it == '/' } }
        assertThat(deepestOption).isLessThanOrEqualTo(MAX_SCHEMA_DEPTH + 1)
    }

    /** Counts the options including the nested options of collections. */
    private fun countOptions(options: List<ValueResolverOption>): Int =
        options.sumOf { 1 + countOptions(it.children.orEmpty()) }

    /**
     * Builds an object schema whose `level` property is again such an object, [depth] levels deep, ending in a
     * string. Built through the everit builders rather than [schemaOf], because loading a schema this deep from
     * JSON validates it against the draft-07 meta-schema, and that validation recurses per level and overflows
     * the stack before the walker under test is ever reached.
     */
    private fun nestedObjectSchema(depth: Int): Schema {
        var schema: Schema = StringSchema.builder().build()
        repeat(depth + 1) {
            schema = ObjectSchema.builder().addPropertySchema("level", schema).build()
        }
        return schema
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
