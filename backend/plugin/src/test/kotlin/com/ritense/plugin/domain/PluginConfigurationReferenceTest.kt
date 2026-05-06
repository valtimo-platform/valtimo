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

package com.ritense.plugin.domain

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class PluginConfigurationReferenceTest {

    @Test
    fun `FIXED allows pluginDefinitionKey to be null`() {
        val ref = PluginConfigurationReference(
            type = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = null,
        )
        assertThat(ref.pluginDefinitionKey).isNull()
    }

    @Test
    fun `FIXED allows pluginDefinitionKey to be set`() {
        val ref = PluginConfigurationReference(
            type = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = "zaken-api",
        )
        assertThat(ref.pluginDefinitionKey).isEqualTo("zaken-api")
    }

    @Test
    fun `BUILDING_BLOCK requires pluginDefinitionKey`() {
        assertThatThrownBy {
            PluginConfigurationReference(
                type = PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey = null,
            )
        }.isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("pluginDefinitionKey is required")
    }

    @Test
    fun `BUILDING_BLOCK rejects blank pluginDefinitionKey`() {
        assertThatThrownBy {
            PluginConfigurationReference(
                type = PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey = "  ",
            )
        }.isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `BUILDING_BLOCK with key is valid`() {
        assertThatCode {
            PluginConfigurationReference(
                type = PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey = "zaken-api",
            )
        }.doesNotThrowAnyException()
    }
}
