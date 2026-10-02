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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

internal class PluginConfigurationTest {

    lateinit var configuration: PluginConfiguration

    @BeforeEach
    fun init() {
        val input = """
            {
                "property1": "old-value",
                "property2": false,
                "property3": 123
            }
        """.trimMargin()

        val props = mutableSetOf<PluginProperty>()

        val pluginDefinition = PluginDefinition(
            "key",
            "title",
            "description",
            "some-class",
            props
        )

        props.add(
            PluginProperty(
                "key",
                pluginDefinition,
                "title",
                false,
                true,
                "property1",
                "test"
            )
        )

        props.add(
            PluginProperty(
                "key",
                pluginDefinition,
                "title",
                false,
                false,
                "property2",
                "test"
            )
        )
        props.add(
            PluginProperty(
                "key",
                pluginDefinition,
                "title",
                false,
                false,
                "property3",
                "test"
            )
        )

        configuration = PluginConfiguration(
            PluginConfigurationId.newId(),
            "title",
            MapperSingleton.get().readTree(input) as ObjectNode,
            pluginDefinition
        )

        val encryptionService = mock<EncryptionService>()
        whenever(encryptionService.encrypt(any())).thenAnswer { it.arguments[0] }
        whenever(encryptionService.decrypt(any())).thenAnswer { it.arguments[0] }
        configuration.objectMapper = MapperSingleton.get()
        configuration.encryptionService = encryptionService
    }

    @Test
    fun `should update property when new value is present`() {
        val input = """
            {
                "property1": "test123",
                "property2": false,
                "property3": 456
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertEquals(456, configuration.properties?.get("property3")?.intValue())
    }

    @Test
    fun `should update secret property when new value is not null`() {
        val input = """
            {
                "property1": "test",
                "property2": false,
                "property3": 123
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertEquals("test", configuration.properties?.get("property1")?.textValue())
    }

    @Test
    fun `should not update secret property when new value is null`() {
        val input = """
            {
                "property1": null,
                "property2": false,
                "property3": 123
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertEquals("old-value", configuration.properties?.get("property1")?.textValue())
    }

    @Test
    fun `should not update secret property when new value is missing`() {
        val input = """
            {
                "property2": false,
                "property3": 123
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertEquals("old-value", configuration.properties?.get("property1")?.textValue())
    }

    @Test
    fun `should not update secret property when new value is empty string`() {
        val input = """
            {
                "property1": "",
                "property2": false,
                "property3": 123
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertEquals("old-value", configuration.properties?.get("property1")?.textValue())
    }


    @Test
    fun `should update property when new value is null`() {
        val input = """
            {
                "property1": "test123",
                "property2": false,
                "property3": null
            }
        """.trimMargin()

        configuration.updateProperties(MapperSingleton.get().readTree(input) as ObjectNode)

        assertTrue(configuration.properties?.get("property3")!!.isNull)
    }

    @Test
    fun `should remove properties no longer defined by plugin`() {
        val deprecatedPropertyJson = """
            {
                "property1": "value",
                "property2": false,
                "property3": 123,
                "deprecatedProperty": "should-be-removed",
                "anotherOldProperty": true
            }
        """.trimMargin()

        val configWithDeprecatedProps = PluginConfiguration(
            PluginConfigurationId.newId(),
            "title",
            MapperSingleton.get().readTree(deprecatedPropertyJson) as ObjectNode,
            configuration.pluginDefinition
        )
        configWithDeprecatedProps.objectMapper = MapperSingleton.get()
        configWithDeprecatedProps.encryptionService = configuration.encryptionService

        val updateInput = """
            {
                "property1": "new-value",
                "property2": true,
                "property3": 456
            }
        """.trimMargin()

        configWithDeprecatedProps.updateProperties(MapperSingleton.get().readTree(updateInput) as ObjectNode)

        assertEquals("new-value", configWithDeprecatedProps.properties?.get("property1")?.textValue())
        assertEquals(true, configWithDeprecatedProps.properties?.get("property2")?.booleanValue())
        assertEquals(456, configWithDeprecatedProps.properties?.get("property3")?.intValue())
        assertTrue(configWithDeprecatedProps.properties?.has("deprecatedProperty") == false)
        assertTrue(configWithDeprecatedProps.properties?.has("anotherOldProperty") == false)
    }

}