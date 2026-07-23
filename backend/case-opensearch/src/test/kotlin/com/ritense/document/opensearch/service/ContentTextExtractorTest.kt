/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.opensearch.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ContentTextExtractorTest {

    private val mapper = ObjectMapper()

    @Test
    fun `null input returns null`() {
        assertThat(extractLeafValues(null)).isNull()
    }

    @Test
    fun `empty object returns null`() {
        val node = mapper.readTree("{}")
        assertThat(extractLeafValues(node)).isNull()
    }

    @Test
    fun `flat object joins all leaf values`() {
        val node = mapper.readTree("""{"firstName":"John","lastName":"Doe"}""")
        val result = extractLeafValues(node)
        assertThat(result).contains("John")
        assertThat(result).contains("Doe")
    }

    @Test
    fun `nested object extracts leaves recursively`() {
        val node = mapper.readTree("""{"person":{"name":"Alice","city":"Utrecht"}}""")
        val result = extractLeafValues(node)
        assertThat(result).contains("Alice")
        assertThat(result).contains("Utrecht")
    }

    @Test
    fun `array of primitives is extracted`() {
        val node = mapper.readTree("""["apple","banana","cherry"]""")
        assertThat(extractLeafValues(node)).isEqualTo("apple banana cherry")
    }

    @Test
    fun `array of objects extracts nested leaves`() {
        val node = mapper.readTree("""[{"name":"X"},{"name":"Y"}]""")
        val result = extractLeafValues(node)
        assertThat(result).contains("X")
        assertThat(result).contains("Y")
    }

    @Test
    fun `null json field values are skipped`() {
        val node = mapper.readTree("""{"name":null,"city":null}""")
        assertThat(extractLeafValues(node)).isNull()
    }

    @Test
    fun `numeric value is converted to string`() {
        val node = mapper.readTree("""{"count":42}""")
        assertThat(extractLeafValues(node)).isEqualTo("42")
    }

    @Test
    fun `boolean value is converted to string`() {
        val node = mapper.readTree("""{"active":true}""")
        assertThat(extractLeafValues(node)).isEqualTo("true")
    }

    @Test
    fun `mixed types in object are all extracted`() {
        val node = mapper.readTree("""{"name":"Bob","age":30,"active":false}""")
        val result = extractLeafValues(node)
        assertThat(result).contains("Bob")
        assertThat(result).contains("30")
        assertThat(result).contains("false")
    }

    @Test
    fun `deeply nested structure is fully extracted`() {
        val node = mapper.readTree("""{"a":{"b":{"c":"deep"}}}""")
        assertThat(extractLeafValues(node)).isEqualTo("deep")
    }

    @Test
    fun `mixed null and non-null leaves only includes non-null values`() {
        val node = mapper.readTree("""{"name":"Alice","missing":null}""")
        val result = extractLeafValues(node)
        assertThat(result).isEqualTo("Alice")
    }
}
