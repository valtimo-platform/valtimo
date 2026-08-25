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
import org.assertj.core.api.Assertions.assertThat
import org.everit.json.schema.Schema
import org.junit.jupiter.api.Test

class EveritSchemaAllowsPropertyTest {

    @Test
    fun `should allow a property the schema describes`() {
        val schema = schemaOf(
            """
            "properties": {
              "firstName": { "type": "string" }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/firstName")).isTrue()
    }

    @Test
    fun `should refuse an undescribed property when additionalProperties is not permitted`() {
        val schema = schemaOf(
            """
            "additionalProperties": false,
            "properties": {
              "firstName": { "type": "string" }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/lastName")).isFalse()
    }

    @Test
    fun `should allow an undescribed property when additionalProperties is permitted`() {
        val schema = schemaOf(
            """
            "additionalProperties": true,
            "properties": {
              "firstName": { "type": "string" }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/lastName")).isTrue()
    }

    /**
     * `additionalProperties` is evaluated at every level of the descent, so a permissive root used to
     * answer for the whole subtree beneath it: the check never reached `applicant`'s own refusal.
     */
    @Test
    fun `should not let a permissive root answer for a nested object that refuses the property`() {
        val schema = schemaOf(
            """
            "additionalProperties": true,
            "properties": {
              "applicant": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "city": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/applicant/city")).isTrue()
        assertThat(schema.allowsProperty("/applicant/street")).isFalse()
    }

    /**
     * The counterpart: a nested object that does permit additional properties still answers for itself,
     * so the refusal above is about the *described* token, not about nesting as such.
     */
    @Test
    fun `should allow an undescribed property under a nested object that permits additional properties`() {
        val schema = schemaOf(
            """
            "additionalProperties": false,
            "properties": {
              "applicant": {
                "type": "object",
                "additionalProperties": true,
                "properties": {
                  "city": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/applicant/street")).isTrue()
    }

    @Test
    fun `should answer a described property through its own definition rather than patternProperties`() {
        val schema = schemaOf(
            """
            "additionalProperties": true,
            "patternProperties": {
              "^extra": { "type": "string" }
            },
            "properties": {
              "applicant": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "city": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/extraNotes")).isTrue()
        assertThat(schema.allowsProperty("/applicant/street")).isFalse()
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
