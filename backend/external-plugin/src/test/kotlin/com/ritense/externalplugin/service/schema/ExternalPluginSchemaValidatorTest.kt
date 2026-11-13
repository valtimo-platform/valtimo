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

package com.ritense.externalplugin.service.schema

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.service.schema.ExternalPluginSchemaValidator.Compiled
import com.ritense.externalplugin.service.schema.ExternalPluginSchemaValidator.Outcome
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertTimeoutPreemptively
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ExternalPluginSchemaValidatorTest {

    private val objectMapper = ObjectMapper()
    private val validator = ExternalPluginSchemaValidator()
    private val redos = "(.*a){8}\$"
    private val hostile = "a".repeat(60) + "!"

    private fun json(text: String): JsonNode = objectMapper.readTree(text)

    private fun validateWithin2s(schema: String, value: JsonNode): Outcome =
        assertTimeoutPreemptively<Outcome>(Duration.ofSeconds(2)) { validator.validate(json(schema), value) }

    @Test
    fun `a catastrophic pattern is cut off at the budget`() {
        val outcome = validateWithin2s("""{"type":"string","pattern":"$redos"}""", objectMapper.valueToTree(hostile))

        assertThat(outcome).isInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `a catastrophic patternProperties is cut off at the budget`() {
        val value = objectMapper.createObjectNode().put(hostile, 1)

        val outcome = validateWithin2s("""{"patternProperties":{"$redos":{"type":"integer"}}}""", value)

        assertThat(outcome).isInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `a catastrophic patternProperties with closed additionalProperties is cut off at the budget`() {
        val value = objectMapper.createObjectNode().put(hostile, 1)

        val outcome = validateWithin2s(
            """{"additionalProperties":false,"patternProperties":{"$redos":{"type":"integer"}}}""", value,
        )

        assertThat(outcome).isInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `the budget spans a whole validation, not one match`() {
        val values = objectMapper.createArrayNode().apply { repeat(2000) { add("a".repeat(200) + "!") } }

        val outcome = validateWithin2s("""{"type":"array","items":{"pattern":"(.*a){4}$"}}""", values)

        assertThat(outcome).isInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `a stack overflow in the regex engine is contained`() {
        val outcome = validateWithin2s("""{"pattern":"^(a|b)*$"}""", objectMapper.valueToTree("ab".repeat(100_000)))

        assertThat(outcome).isInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `ordinary patterns behave as before`() {
        assertThat(validateWithin2s("""{"pattern":"^[0-9]{4}$"}""", objectMapper.valueToTree("2026"))).isEqualTo(Outcome.Valid)
        assertThat(validateWithin2s("""{"pattern":"^[0-9]{4}$"}""", objectMapper.valueToTree("20x6")))
            .isInstanceOf(Outcome.Violations::class.java)
        val lookahead = """{"pattern":"^(?=.*\\d).+$"}"""
        assertThat(validateWithin2s(lookahead, objectMapper.valueToTree("ab1"))).isEqualTo(Outcome.Valid)
        assertThat(validateWithin2s(lookahead, objectMapper.valueToTree("abc"))).isInstanceOf(Outcome.Violations::class.java)
        val backreference = """{"pattern":"^(a)\\1$"}"""
        assertThat(validateWithin2s(backreference, objectMapper.valueToTree("aa"))).isEqualTo(Outcome.Valid)
        assertThat(validateWithin2s(backreference, objectMapper.valueToTree("ab"))).isInstanceOf(Outcome.Violations::class.java)
    }

    @Test
    fun `a remote reference is an invalid schema`() {
        val outcome = validateWithin2s("""{"${'$'}ref":"https://schemas.example.com/plan.json"}""", objectMapper.valueToTree("x"))

        assertThat(outcome).isInstanceOf(Outcome.SchemaInvalid::class.java)
    }

    @Test
    fun `a schema that is not an object is invalid`() {
        assertThat(validateWithin2s("\"string\"", objectMapper.valueToTree("x")))
            .isEqualTo(Outcome.SchemaInvalid("the schema must be a JSON object"))
    }

    @Test
    fun `a schema above the size cap is invalid`() {
        val small = ExternalPluginSchemaValidator(maxSchemaBytes = 50)
        val schema = json("""{"description":"${"x".repeat(100)}"}""")

        assertThat(small.validate(schema, objectMapper.valueToTree("x"))).isInstanceOf(Outcome.SchemaInvalid::class.java)
        assertThat(small.compile(schema)).isInstanceOf(Compiled.Invalid::class.java)
    }

    @Test
    fun `format regex never runs a match`() {
        val schema = """{"type":"string","format":"regex"}"""

        assertThat(validateWithin2s(schema, objectMapper.valueToTree("^a+$"))).isEqualTo(Outcome.Valid)
        assertThat(validateWithin2s(schema, objectMapper.valueToTree("["))).isNotInstanceOf(Outcome.Unverifiable::class.java)
    }

    @Test
    fun `the same content compiles once and different content compiles anew`() {
        val first = validator.compile(json("""{"type":"string"}"""))
        val again = validator.compile(json("""{ "type" : "string" }"""))
        val other = validator.compile(json("""{"type":"integer"}"""))

        assertThat(again).isSameAs(first)
        assertThat(other).isNotSameAs(first)
    }

    @Test
    fun `an invalid result is cached`() {
        val first = validator.compile(json("""{"pattern":"["}"""))
        val again = validator.compile(json("""{"pattern":"["}"""))

        assertThat(first).isInstanceOf(Compiled.Invalid::class.java)
        assertThat(again).isSameAs(first)
    }

    @Test
    fun `the least recently used schema is evicted first`() {
        val small = ExternalPluginSchemaValidator(maxCachedSchemas = 2)
        val a = small.compile(json("""{"type":"string"}"""))
        val b = small.compile(json("""{"type":"integer"}"""))
        small.compile(json("""{"type":"string"}"""))
        small.compile(json("""{"type":"boolean"}"""))

        assertThat(small.compile(json("""{"type":"string"}"""))).isSameAs(a)
        assertThat(small.compile(json("""{"type":"integer"}"""))).isNotSameAs(b)
    }

    @Test
    fun `concurrent validations against one cached schema stay correct`() {
        val schema = json("""{"type":"string","pattern":"^[a-z]+$"}""")
        val pool = Executors.newFixedThreadPool(16)
        try {
            val results = (1..16).map {
                pool.submit<Boolean> {
                    (1..200).all {
                        validator.validate(schema, objectMapper.valueToTree("abc")) == Outcome.Valid &&
                            validator.validate(schema, objectMapper.valueToTree("ABC")) is Outcome.Violations
                    }
                }
            }
            assertThat(results.map { it.get(10, TimeUnit.SECONDS) }).containsOnly(true)
        } finally {
            pool.shutdownNow()
        }
    }

    @Test
    fun `contract schema errors list each unusable input and output`() {
        val manifest = json(
            """
            {"provides":[
              {"contract":"a@1","operations":[
                {"key":"one","input":{"pattern":"["},"output":{"type":"object"}},
                {"key":"two","input":{"type":"object"}}]},
              {"contract":"b@1","operations":[{"key":"three","output":{"pattern":"["}}]}
            ]}
            """.trimIndent()
        )

        val errors = validator.contractSchemaErrors(manifest)

        assertThat(errors).hasSize(2)
        assertThat(errors[0]).startsWith("Operation 'one' of contract 'a@1' declares an invalid input schema")
        assertThat(errors[1]).startsWith("Operation 'three' of contract 'b@1' declares an invalid output schema")
    }

    @Test
    fun `contract schema errors are empty for a valid manifest or one without provides`() {
        assertThat(validator.contractSchemaErrors(json("""{"provides":[{"contract":"a@1","operations":[{"key":"x","input":{"type":"object"}}]}]}"""))).isEmpty()
        assertThat(validator.contractSchemaErrors(json("{}"))).isEmpty()
        assertThat(validator.contractSchemaErrors(null)).isEmpty()
    }
}
