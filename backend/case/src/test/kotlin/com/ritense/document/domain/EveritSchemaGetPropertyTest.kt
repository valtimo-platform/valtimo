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
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema
import org.everit.json.schema.ValidationException
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
    fun `should resolve the item schema of an array element the pointer stops at`() {
        // The pointer ends at the index, so the answer is the item's own schema. It used to be null, which
        // made an array element's parent unresolvable and every property inside one impossible to clear.
        val schema = arraySchema()

        assertThat(schema.getProperty("/items/0")).isInstanceOf(ObjectSchema::class.java)
        assertThat(schema.getProperty("/items/0/value")).isInstanceOf(StringSchema::class.java)
    }

    @Test
    fun `should refuse an array index the schema cannot have`() {
        val schema = arraySchema()

        assertThat(schema.getProperty("/items/5")).isNull()
        assertThat(schema.getProperty("/items/-1")).isNull()
    }

    @Test
    fun `should answer a path its combined branches disagree about with all of them`() {
        // No single branch is the schema of `/p/v`, and returning the first match made the answer depend on
        // the order the branches were written in — which is what DocumentMigrationService compares and what
        // getTypeReference() coerces from.
        val stringFirst = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "v": { "type": "number" } } }"""
        )
        val numberFirst = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "number" } } },
               { "type": "object", "properties": { "v": { "type": "string" } } }"""
        )

        assertThat(stringFirst.getProperty("/p/v")).isInstanceOf(CombinedSchema::class.java)
        // Canonically ordered, so the same set of branches compares equal however it was declared — the
        // comparison DocumentMigrationService makes to decide whether a property's type changed.
        assertThat(stringFirst.getProperty("/p/v")).isEqualTo(numberFirst.getProperty("/p/v"))
        // And nothing is coerced to the type that happened to come first.
        assertThat(stringFirst.getProperty("/p/v")?.getTypeReference()?.type).isEqualTo(Any::class.java)
    }

    @Test
    fun `should answer with the branch itself when only one describes the path`() {
        val schema = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "other": { "type": "number" } } }"""
        )

        assertThat(schema.getProperty("/p/v")).isInstanceOf(StringSchema::class.java)
    }

    /**
     * `allOf` means every branch has to be satisfied. Recombining the branches as `anyOf` weakened that
     * to "any of them", so the recombined schema accepted values the original rejects — and everything
     * built on this walk validates against what it returns.
     */
    @Test
    fun `should recombine allOf branches with the allOf criterion`() {
        val schema = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "string", "minLength": 5 } } },
               { "type": "object", "properties": { "v": { "type": "string", "maxLength": 3 } } }""",
            criterion = "allOf"
        )

        val property = schema.getProperty("/p/v")
        assertThat(property).isInstanceOf(CombinedSchema::class.java)
        assertThat((property as CombinedSchema).criterion).isEqualTo(CombinedSchema.ALL_CRITERION)
        // Nothing satisfies both minLength 5 and maxLength 3. Recombined as anyOf, this string passed.
        assertThatThrownBy { property.validate("Ada Lovelace") }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    fun `should recombine oneOf branches with the oneOf criterion`() {
        val schema = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "v": { "type": "number" } } }"""
        )

        assertThat((schema.getProperty("/p/v") as CombinedSchema).criterion)
            .isEqualTo(CombinedSchema.ONE_CRITERION)
    }

    @Test
    fun `should collapse combined branches that describe the path identically`() {
        val schema = combinedSchemaOf(
            """{ "type": "object", "properties": { "v": { "type": "string" } } },
               { "type": "object", "properties": { "v": { "type": "string" } } }"""
        )

        assertThat(schema.getProperty("/p/v")).isInstanceOf(StringSchema::class.java)
    }

    @Test
    fun `should not let a permissive ancestor answer for a schema that refuses additional properties`() {
        val schema = schemaOf(
            """
            "additionalProperties": true,
            "properties": {
              "a": {
                "type": "object",
                "additionalProperties": false,
                "properties": { "x": { "type": "string" } }
              }
            }
            """.trimIndent()
        )

        assertThat(schema.allowsProperty("/a/x")).isTrue()
        // `a` declares no `b` and refuses additional properties; the root's permission is not `a`'s to give.
        assertThat(schema.allowsProperty("/a/b")).isFalse()
        // A token the root itself does not describe is what "additional" means, and is still allowed.
        assertThat(schema.allowsProperty("/zzz")).isTrue()
        assertThat(schema.allowsProperty("/zzz/deeper")).isTrue()
    }

    @Test
    fun `should stop resolving beyond the maximum schema depth instead of overflowing the stack`() {
        val schema = recursiveSchema()
        val tooDeep = "/root" + "/child".repeat(MAX_SCHEMA_DEPTH + 20) + "/name"

        assertThat(schema.getProperty(tooDeep)).isNull()
        assertDoesNotThrow { schema.allowsProperty(tooDeep) }
    }

    @Test
    fun `should not overflow the stack when an allOf refers back to itself`() {
        val schema = schemaOf(
            """
            "definitions": {
              "node": {
                "allOf": [ { "${'$'}ref": "#/definitions/node" } ]
              }
            },
            "properties": {
              "root": { "${'$'}ref": "#/definitions/node" }
            }
            """.trimIndent()
        )

        // without the depth guard both walkers recurse through the cycle until the JVM throws a StackOverflowError
        assertThat(schema.getProperty("/root/name")).isNull()
        // `root` is a declared property, so its own schema answers for everything below it — and that schema
        // is a cycle that establishes nothing. The root permitting additional properties does not make
        // `/root/name` allowed; "additional" is about tokens the root does not describe, and it describes
        // `root`. (This answered true until that fallback was scoped to undescribed tokens.)
        assertThat(schema.allowsProperty("/root/name")).isFalse()
    }

    @Test
    fun `should not overflow the stack when a schema dependency refers back to itself`() {
        // the dependency key deliberately differs from the property being looked up, so the walkers have to descend
        // into the dependency schema instead of short-circuiting on the key itself
        val schema = schemaOf(
            """
            "definitions": {
              "node": {
                "type": "object",
                "dependencies": { "trigger": { "${'$'}ref": "#/definitions/node" } }
              }
            },
            "properties": {
              "root": { "${'$'}ref": "#/definitions/node" }
            }
            """.trimIndent()
        )

        assertThat(schema.getProperty("/root/name")).isNull()
        assertThat(schema.allowsProperty("/root/name")).isTrue()
    }

    /**
     * A schema that recurses through `properties`, so every step consumes a json pointer segment and a lookup for
     * a finite path terminates on its own. Contrast the `allOf` and `dependencies` cycles above, which recurse on
     * the *same* field and are stopped only by [MAX_SCHEMA_DEPTH].
     */
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

    private fun arraySchema(): Schema = schemaOf(
        """
        "properties": {
          "items": {
            "type": "array",
            "maxItems": 3,
            "items": {
              "type": "object",
              "properties": { "value": { "type": "string" } }
            }
          }
        }
        """.trimIndent()
    )

    /** A root with one property `p` whose schema is a `oneOf` of the given branches. */
    private fun combinedSchemaOf(branches: String, criterion: String = "oneOf"): Schema = schemaOf(
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
