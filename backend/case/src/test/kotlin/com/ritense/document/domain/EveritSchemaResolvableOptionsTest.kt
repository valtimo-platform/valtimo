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
import com.ritense.valueresolver.ValueResolverOptionType.COLLECTION
import com.ritense.valueresolver.ValueResolverOptionType.FIELD
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
