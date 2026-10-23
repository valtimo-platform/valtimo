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

package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class TargetFieldsTest {

    @Test
    fun `normalizeField strips the doc prefix, adds a leading slash and trims trailing slashes`() {
        assertThat(normalizeField("doc:/a/b")).isEqualTo("/a/b")
        assertThat(normalizeField("doc:a/b")).isEqualTo("/a/b")
        assertThat(normalizeField("a")).isEqualTo("/a")
        assertThat(normalizeField("/a/")).isEqualTo("/a")
        assertThat(normalizeField("doc:/a//")).isEqualTo("/a")
    }

    @Test
    fun `has matches regardless of prefix and slashes`() {
        val fields = TargetFields(listOf(field("a/b/", false)))

        assertThat(fields.names).containsExactly("/a/b")
        assertThat(fields.has("doc:/a/b")).isTrue()
        assertThat(fields.has("/a/b/")).isTrue()
        assertThat(fields.has("a/b")).isTrue()
        assertThat(fields.has("/a")).isFalse()
    }

    @Test
    fun `a required field under an optional parent is not required`() {
        val fields = TargetFields(
            listOf(
                field("/opt", false),
                field("/opt/x", true),
                field("/req", true),
                field("/req/x", true),
                field("/undeclared/x", true),
            )
        )

        assertThat(fields.required).containsExactly("/req", "/req/x", "/undeclared/x")
    }

    @Test
    fun `a required field under a required parent under an optional grandparent is not required`() {
        val fields = TargetFields(listOf(field("/opt", false), field("/opt/a", true), field("/opt/a/b", true)))

        assertThat(fields.required).isEmpty()
    }

    @Test
    fun `a mapping covers the field itself and its descendants, not siblings sharing a prefix`() {
        val fields = TargetFields(emptyList())

        assertThat(fields.isCovered("/a", listOf("/a"))).isTrue()
        assertThat(fields.isCovered("/a/b", listOf("/a"))).isTrue()
        assertThat(fields.isCovered("/a/b/c", listOf("/a"))).isTrue()
        assertThat(fields.isCovered("/ab", listOf("/a"))).isFalse()
        assertThat(fields.isCovered("/a", listOf("/a/b"))).isFalse()
        assertThat(fields.isCovered("/a", emptyList())).isFalse()
    }

    private fun field(name: String, required: Boolean) = BuildingBlockFieldDto(name, required)
}
