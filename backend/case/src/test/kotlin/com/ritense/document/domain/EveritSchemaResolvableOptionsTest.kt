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
import org.everit.json.schema.Schema
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
    fun `should still expose an array as a single collection option`() {
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

        assertThat(options).hasSize(1)
        assertThat(options.single().path).isEqualTo("doc:/tags")
        assertThat(options.single().type).isEqualTo(COLLECTION)
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
        val options = schemaOf(nestedObjectProperties(MAX_SCHEMA_DEPTH + 20)).collectValueResolverOptions("doc:")

        val deepestOption = options.maxOf { option -> option.path.count { it == '/' } }
        assertThat(deepestOption).isLessThanOrEqualTo(MAX_SCHEMA_DEPTH + 1)
    }

    /** Counts the options including the nested options of collections. */
    private fun countOptions(options: List<ValueResolverOption>): Int =
        options.sumOf { 1 + countOptions(it.children.orEmpty()) }

    /** Builds `"properties": { "level": { ... "properties": { "level": { "type": "string" } } } }`, [depth] levels deep. */
    private fun nestedObjectProperties(depth: Int): String {
        var properties = """"properties": { "level": { "type": "string" } }"""
        repeat(depth) {
            properties = """"properties": { "level": { "type": "object", $properties } }"""
        }
        return properties
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
