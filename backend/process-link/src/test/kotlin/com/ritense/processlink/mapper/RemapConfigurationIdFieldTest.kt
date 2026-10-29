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

package com.ritense.processlink.mapper

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class RemapConfigurationIdFieldTest {

    private val objectMapper = ObjectMapper()

    @Test
    fun `rewrites the field to the mapped target id`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val node = objectMapper.createObjectNode().put("configId", sourceId.toString())

        remapConfigurationIdField(node, "configId", mapOf(sourceId to targetId))

        assertThat(node.get("configId").asText()).isEqualTo(targetId.toString())
    }

    @Test
    fun `nulls the field when the mapping value is null and allowNull is true`() {
        val sourceId = UUID.randomUUID()
        val node = objectMapper.createObjectNode().put("configId", sourceId.toString())

        remapConfigurationIdField(node, "configId", mapOf(sourceId to null))

        assertThat(node.get("configId").isNull).isTrue()
    }

    @Test
    fun `leaves the field unchanged when the mapping value is null and allowNull is false`() {
        val sourceId = UUID.randomUUID()
        val node = objectMapper.createObjectNode().put("configId", sourceId.toString())

        remapConfigurationIdField(node, "configId", mapOf(sourceId to null), allowNull = false)

        assertThat(node.get("configId").asText()).isEqualTo(sourceId.toString())
    }

    @Test
    fun `leaves the field unchanged when there is no mapping entry for the original id`() {
        val sourceId = UUID.randomUUID()
        val node = objectMapper.createObjectNode().put("configId", sourceId.toString())

        remapConfigurationIdField(node, "configId", mapOf(UUID.randomUUID() to UUID.randomUUID()))

        assertThat(node.get("configId").asText()).isEqualTo(sourceId.toString())
    }

    @Test
    fun `is a no-op when the field is absent`() {
        val node = objectMapper.createObjectNode()

        remapConfigurationIdField(node, "configId", mapOf(UUID.randomUUID() to UUID.randomUUID()))

        assertThat(node.has("configId")).isFalse()
    }

    @Test
    fun `is a no-op when the field is not a valid UUID`() {
        val node = objectMapper.createObjectNode().put("configId", "not-a-uuid")

        remapConfigurationIdField(node, "configId", mapOf(UUID.randomUUID() to UUID.randomUUID()))

        assertThat(node.get("configId").asText()).isEqualTo("not-a-uuid")
    }
}
