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

package com.ritense.valtimo.contract.json

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.OffsetDateTime
import java.time.ZoneOffset

class Iso8601DeserializerTest {

    private val objectMapper = ObjectMapper()
        .registerModule(KotlinModule.Builder().build())

    @Test
    fun `should deserialize offset datetime`() {
        val json = """{"value": "2026-03-23T14:37:41+01:00"}"""

        val result = objectMapper.readValue<TestDto>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.ofHours(1)), result.value)
    }

    @Test
    fun `should deserialize UTC datetime with Z suffix`() {
        val json = """{"value": "2026-03-23T14:37:41Z"}"""

        val result = objectMapper.readValue<TestDto>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.UTC), result.value)
    }

    @Test
    fun `should deserialize zoned datetime`() {
        val json = """{"value": "2026-03-23T14:37:41+01:00[Europe/Amsterdam]"}"""

        val result = objectMapper.readValue<TestDto>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.ofHours(1)), result.value)
    }

    @Test
    fun `should deserialize local datetime as UTC`() {
        val json = """{"value": "2026-03-23T14:37:41"}"""

        val result = objectMapper.readValue<TestDto>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.UTC), result.value)
    }

    @Test
    fun `should return null for null value`() {
        val json = """{"value": null}"""

        val result = objectMapper.readValue<NullableTestDto>(json)

        assertEquals(null, result.value)
    }

    @Test
    fun `should return null for blank value`() {
        val json = """{"value": "  "}"""

        val result = objectMapper.readValue<NullableTestDto>(json)

        assertEquals(null, result.value)
    }

    @Test
    fun `should throw error for invalid datetime`() {
        val json = """{"value": "not-a-date"}"""

        assertThrows<Exception> {
            objectMapper.readValue<TestDto>(json)
        }
    }

    private data class TestDto(
        @JsonDeserialize(using = Iso8601Deserializer::class)
        val value: OffsetDateTime
    )

    private data class NullableTestDto(
        @JsonDeserialize(using = Iso8601Deserializer::class)
        val value: OffsetDateTime?
    )
}