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

package com.ritense.externalplugin.domain

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ExternalPluginCapabilityTest {

    @Test
    fun `parses every known capability value`() {
        assertThat(ExternalPluginCapability.fromValue("gzac_api")).isEqualTo(ExternalPluginCapability.GZAC_API)
        assertThat(ExternalPluginCapability.fromValue("http_request")).isEqualTo(ExternalPluginCapability.HTTP_REQUEST)
        assertThat(ExternalPluginCapability.fromValue("kv")).isEqualTo(ExternalPluginCapability.KV)
        assertThat(ExternalPluginCapability.fromValue("log")).isEqualTo(ExternalPluginCapability.LOG)
    }

    @Test
    fun `rejects unknown capability value with the known values in the message`() {
        assertThatThrownBy { ExternalPluginCapability.fromValue("filesystem") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Unknown capability 'filesystem'")
            .hasMessageContaining("gzac_api, http_request, kv, log")
    }

    @Test
    fun `rejects enum name spelling - only the wire value is accepted`() {
        assertThatThrownBy { ExternalPluginCapability.fromValue("HTTP_REQUEST") }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `converter round-trips every capability through its column value`() {
        val converter = ExternalPluginCapabilityConverter()
        ExternalPluginCapability.entries.forEach { capability ->
            val column = converter.convertToDatabaseColumn(capability)
            assertThat(column).isEqualTo(capability.value)
            assertThat(converter.convertToEntityAttribute(column)).isEqualTo(capability)
        }
    }

    @Test
    fun `converter rejects unknown column value`() {
        assertThatThrownBy { ExternalPluginCapabilityConverter().convertToEntityAttribute("random stuff") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Unknown capability 'random stuff'")
    }
}
