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
package com.ritense.valtimo.test.golden

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class GoldenJsonTest {

    @Test
    fun `masks uuids anywhere in strings and keys`() {
        val node = GoldenJson.normalize(
            """{"id":"6f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11","href":"/api/v1/document/6f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11",
               "6f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11":1,"0c2e9d6a-6b0e-4f7e-8a51-0a3b1c2d3e4f":2}"""
        )

        assertThat(node.get("id").asText()).isEqualTo("<uuid>")
        assertThat(node.get("href").asText()).isEqualTo("/api/v1/document/<uuid>")
        assertThat(node.has("<uuid>")).isTrue()
        assertThat(node.has("<uuid>~2")).isTrue()
    }

    @Test
    fun `masks only the digits of dates so the format stays visible`() {
        val node = GoldenJson.normalize(
            """{"a":"2026-11-26T10:15:30.123Z","b":"2026-11-26T10:15:30","c":"2026-11-26","d":"2026-11-26T10:15:30+01:00"}"""
        )

        assertThat(node.get("a").asText()).isEqualTo("<date:dddd-dd-ddTdd:dd:dd.dddZ>")
        assertThat(node.get("b").asText()).isEqualTo("<date:dddd-dd-ddTdd:dd:dd>")
        assertThat(node.get("c").asText()).isEqualTo("<date:dddd-dd-dd>")
        assertThat(node.get("d").asText()).isEqualTo("<date:dddd-dd-ddTdd:dd:dd+dd:dd>")
    }

    @Test
    fun `replaces ignored paths with their type and supports wildcards`() {
        val node = GoldenJson.normalize(
            """{"content":[{"id":1,"name":"x"},{"id":2,"name":"y"}],"total":2}""",
            listOf("/content/*/id")
        )

        assertThat(node.at("/content/0/id").asText()).isEqualTo("<ignored:number>")
        assertThat(node.at("/content/1/id").asText()).isEqualTo("<ignored:number>")
        assertThat(node.at("/content/1/name").asText()).isEqualTo("y")
        assertThat(node.get("total").asInt()).isEqualTo(2)
    }

    @Test
    fun `leaves other text and numbers alone`() {
        val node = GoldenJson.normalize("""{"name":"case 2026","count":20261126,"version":"1.2.3"}""")

        assertThat(node.get("name").asText()).isEqualTo("case 2026")
        assertThat(node.get("count").asLong()).isEqualTo(20261126)
        assertThat(node.get("version").asText()).isEqualTo("1.2.3")
    }

    @Test
    fun `sorts arrays at unordered paths only`() {
        val node = GoldenJson.normalize(
            """{"a":[{"n":"b"},{"n":"a"}],"b":[{"n":"b"},{"n":"a"}]}""",
            unorderedPaths = listOf("/a")
        )

        assertThat(node.at("/a/0/n").asText()).isEqualTo("a")
        assertThat(node.at("/b/0/n").asText()).isEqualTo("b")
    }
}
