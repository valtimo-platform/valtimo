/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.plugin

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.domain.PluginProperty
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.slf4j.LoggerFactory

internal class PluginFactoryTest {
    lateinit var pluginFactory: PluginFactory<*>
    lateinit var pluginService: PluginService

    @BeforeEach
    fun init() {
        pluginService = mock()
        pluginFactory = TestPluginFactory("someObject", pluginService)
    }

    @Test
    fun `should be able to create plugin instance`() {
        val pluginDefinition = PluginDefinition(
            "key",
            "title",
            "description",
            TestPlugin::class.java.name)
        val pluginConfiguration = PluginConfiguration(
            PluginConfigurationId.newId(),
            "title",
            MapperSingleton.get().readTree("{\"name\": \"whatever\" }") as ObjectNode,
            pluginDefinition
        )

        assertTrue(pluginFactory.canCreate(pluginConfiguration))
    }

    @Test
    fun `should not be able to create plugin instance for different plugin definition`() {
        val pluginDefinition = PluginDefinition("key", "title", "description", "className")
        val pluginConfiguration = PluginConfiguration(
            PluginConfigurationId.newId(),
            "title",
            MapperSingleton.get().readTree("{\"name\": \"whatever\" }") as ObjectNode,
            pluginDefinition
        )

        assertFalse(pluginFactory.canCreate(pluginConfiguration))
    }

    @Test
    fun `should create and initialize plugin instance`() {
        val properties: MutableSet<PluginProperty> = mutableSetOf()
        val pluginDefinition = PluginDefinition(
            "key",
            "title",
            "description",
            TestPlugin::class.java.name,
            properties
        )

        properties.add(
            PluginProperty(
                "property1",
                pluginDefinition,
                "property1",
                true,
                false,
                "property1",
                String::class.java.name
            )
        )

        properties.add(
            PluginProperty(
                "property2",
                pluginDefinition,
                "property2",
                true,
                false,
                "property2",
                Boolean::class.java.name
            )
        )

        properties.add(
            PluginProperty(
                "property3",
                pluginDefinition,
                "property3",
                true,
                false,
                "property3",
                Number::class.java.name
            )
        )

        properties.add(
            PluginProperty(
                "property4",
                pluginDefinition,
                "property4",
                true,
                false,
                "property4",
                TestPluginCategory::class.java.name
            )
        )

        val categoryPluginConfigurationId = PluginConfigurationId.newId()
        val pluginCategory = object : TestPluginCategory {}
        whenever(pluginService.createInstance(categoryPluginConfigurationId)).thenReturn(pluginCategory)
        whenever((pluginService.getObjectMapper())).thenReturn(MapperSingleton.get())
        val pluginConfiguration = PluginConfiguration(
            PluginConfigurationId.newId(),
            "title",
            MapperSingleton.get().valueToTree(
                    TestPluginConfiguredProperties(property1 = "whatever", property3 = 2, property4= categoryPluginConfigurationId.id.toString())
            ),
            pluginDefinition
        )

        val pluginInstance = pluginFactory.create(pluginConfiguration) as TestPlugin
        assertEquals("whatever", pluginInstance.property1)
        assertNull(pluginInstance.property2)
        assertEquals(2, pluginInstance.property3)
        assertEquals(pluginCategory, pluginInstance.property4)
    }

    @Test
    fun `should warn once about a property the plugin no longer defines`() {
        whenever(pluginService.getObjectMapper()).thenReturn(MapperSingleton.get())
        val pluginConfiguration = configurationWithUnknownProperty()

        val events = eventsLoggedWhile { repeat(5) { pluginFactory.create(pluginConfiguration) } }

        assertThat(events.filter { it.level == Level.ERROR }).isEmpty()
        assertThat(events.filter { it.level == Level.WARN }).singleElement().asString()
            .contains("Ignoring unknown property 'noteSubject' on plugin 'Zaken API'")
        assertThat(events.filter { it.level == Level.DEBUG }).hasSize(4)
    }

    @Test
    fun `should warn separately for each configuration that has the same unknown property`() {
        whenever(pluginService.getObjectMapper()).thenReturn(MapperSingleton.get())

        val events = eventsLoggedWhile {
            pluginFactory.create(configurationWithUnknownProperty())
            pluginFactory.create(configurationWithUnknownProperty())
        }

        assertThat(events.filter { it.level == Level.WARN }).hasSize(2)
    }

    private fun configurationWithUnknownProperty() = PluginConfiguration(
        PluginConfigurationId.newId(),
        "Zaken API",
        MapperSingleton.get().readTree("""{"noteSubject": "Zaaknotitie"}""") as ObjectNode,
        PluginDefinition("zakenapi", "title", "description", TestPlugin::class.java.name)
    )

    private fun eventsLoggedWhile(block: () -> Unit): List<ILoggingEvent> {
        val targetLogger = LoggerFactory.getLogger(PluginFactory::class.java) as Logger
        val listAppender = ListAppender<ILoggingEvent>().apply { start() }
        val originalLevel = targetLogger.level
        targetLogger.level = Level.DEBUG
        targetLogger.addAppender(listAppender)

        try {
            block()
        } finally {
            targetLogger.detachAppender(listAppender)
            targetLogger.level = originalLevel
            listAppender.stop()
        }

        return listAppender.list.toList()
    }
}