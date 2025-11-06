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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.plugin.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.plugin.BaseIntegrationTest
import com.ritense.plugin.PluginFactory
import com.ritense.plugin.TestPlugin
import com.ritense.plugin.autodeployment.AutoDeploymentTestPlugin
import com.ritense.plugin.autodeployment.PluginAutoDeploymentDto
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.exception.PluginEventInvocationException
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.doReturn
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.atLeastOnce
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.spy
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.delegate.DelegateTask
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.transaction.annotation.Transactional
import java.lang.reflect.InvocationTargetException
import java.net.URI
import java.util.UUID
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals


@Import(PluginServiceIT.TestResolverConfig::class)
internal class PluginServiceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var pluginDefinitionRepository: PluginDefinitionRepository

    @Autowired
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Autowired
    lateinit var pluginFactory: PluginFactory<TestPlugin>

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var encryptionService: EncryptionService

    @Autowired
    lateinit var buildingBlockPluginConfigurationResolver: BuildingBlockPluginConfigurationResolver


    lateinit var pluginConfiguration: PluginConfiguration
    lateinit var categoryPluginConfiguration: PluginConfiguration
    lateinit var pluginDefinition: PluginDefinition

    @BeforeEach
    fun init() {
        pluginDefinition = pluginDefinitionRepository.getReferenceById("test-plugin")
        pluginConfiguration = pluginConfigurationRepository.save(
            PluginConfiguration(
                PluginConfigurationId.newId(),
                "title",
                objectMapper.createObjectNode(),
                pluginDefinition,
                encryptionService,
                objectMapper
            )
        )

        val categoryPluginDefinition = pluginDefinitionRepository.getReferenceById("test-category-plugin")
        categoryPluginConfiguration = pluginConfigurationRepository.save(
            PluginConfiguration(
                PluginConfigurationId.newId(),
                "title",
                objectMapper.createObjectNode(),
                categoryPluginDefinition,
                encryptionService,
                objectMapper
            )
        )
    }

    @Test
    @Transactional
    fun `should be able to save configuration with encypted property and decrypt on load`() {
        val categoryConfiguration = pluginService.createPluginConfiguration(
            "title",
            objectMapper.readTree("{}") as ObjectNode,
            "test-category-plugin",
        )

        val input = """
            {
                "property1": "test123",
                "property2": false,
                "property3": 123,
                "property4": "${categoryConfiguration.id.id}"
            }
        """.trimMargin()

        val configuration = pluginService.createPluginConfiguration(
            "title",
            objectMapper.readTree(input) as ObjectNode,
            "test-plugin",
        )

        // value should be decrypted when loading from database
        val configurations = pluginService.getPluginConfigurations(PluginConfigurationSearchParameters())
        val configurationFromDatabase = configurations.first { it.id.id == configuration.id.id }

        assertEquals("test123", configurationFromDatabase.properties!!.get("property1").textValue())

        // should still work after updating configuration
        val update = """
            {
                "property1": "test1234",
                "property2": false,
                "property3": 123,
                "property4": "${categoryConfiguration.id.id}"
            }
        """.trimMargin()
        pluginService.updatePluginConfiguration(
            configurationFromDatabase.id,
            "test",
            objectMapper.readTree(update) as ObjectNode
        )

        val configurations2 = pluginService.getPluginConfigurations(PluginConfigurationSearchParameters())
        val configurationFromDatabase2 = configurations2.first { it.id.id == configuration.id.id }

        assertEquals("test1234", configurationFromDatabase2.properties!!.get("property1").textValue())
        assertNotEquals("test1234", configurationFromDatabase2.rawProperties!!.get("property1").textValue())
    }

    @Test
    @Transactional
    fun `should invoke an action on the plugin with void return type`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("{}") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "test-action"
        )

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        pluginService.invoke(execution, processLink)
    }

    @Test
    @Transactional
    fun `should invoke a user task create action on the plugin with void return type`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            actionProperties = objectMapper.readTree("{}") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "test-action-task"
        )

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        val task = mock<DelegateTask>()
        whenever(task.processInstanceId).thenReturn(UUID.randomUUID().toString())
        whenever(task.execution).thenReturn(execution)

        pluginService.invoke(task, processLink)
    }

    @Test
    @Transactional
    fun `should invoke plugin action using building block mapping`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        val mapping = mapOf("test-plugin" to pluginConfiguration.id.id)
        buildingBlockPluginConfigurationResolver.register(execution, mapping)

        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("""{"someString": "test123"}""") as ObjectNode,
            pluginConfigurationReference = PluginConfigurationReference(
                PluginConfigurationReferenceType.BUILDING_BLOCK,
                "test-plugin"
            ),
            pluginActionDefinitionKey = "other-test-action"
        )

        val result = pluginService.invoke(execution, processLink)

        assertEquals("test123", result)
    }

    @Test
    @Transactional
    fun `should fail when building block mapping missing`() {
        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        buildingBlockPluginConfigurationResolver.register(execution, emptyMap())

        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationReference = PluginConfigurationReference(
                PluginConfigurationReferenceType.BUILDING_BLOCK,
                "test-plugin"
            ),
            pluginActionDefinitionKey = "test-action"
        )

        assertThrows(IllegalStateException::class.java) {
            pluginService.invoke(execution, processLink)
        }
    }

    @Test
    @Transactional
    fun `should invoke an action on the plugin with return type`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("""{"someString": "test123"}""") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "other-test-action"
        )

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        val result = pluginService.invoke(execution, processLink)

        assertEquals("test123", result)
    }

    @Test
    @Transactional
    fun `should invoke an action with a placeholder value on the plugin`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("""{"someString": "pv:placeholder"}""") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "other-test-action"
        )

        val testPlugin = spy(TestPlugin("someString"))
        doReturn(testPlugin).whenever(pluginFactory).create(pluginConfiguration)

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())
        whenever(execution.getVariable("placeholder")).thenReturn("1234")

        pluginService.invoke(execution, processLink)

        val argumentCaptor = argumentCaptor<String>()
        verify(testPlugin).testAction(argumentCaptor.capture())

        assertEquals("1234", argumentCaptor.firstValue)
    }

    @Test
    @Transactional
    fun `should handle plugin action property with leading 0`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("""{"someString": "01234"}""") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "other-test-action"
        )

        val testPlugin = spy(TestPlugin("someString"))
        doReturn(testPlugin).whenever(pluginFactory).create(pluginConfiguration)

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())

        pluginService.invoke(execution, processLink)

        val argumentCaptor = argumentCaptor<String>()
        verify(testPlugin).testAction(argumentCaptor.capture())

        assertEquals("01234", argumentCaptor.firstValue)
    }

    @Test
    @Transactional
    fun `should fail when invoking an action with missing required parameter`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "other-test-action"
        )

        assertFailsWith<InvocationTargetException>(
            block = {
                pluginService.invoke(mock<DelegateExecution>(), processLink)
            }
        )
    }

    @Test
    @Transactional
    fun `should invoke an action on the plugin with a URI inside a resolved parameter`() {
        val processLink = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "test",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionProperties = objectMapper.readTree("""{"uriParam": "pv:exampleUrl"}""") as ObjectNode,
            pluginConfigurationId = pluginConfiguration.id,
            pluginConfigurationReference = PluginConfigurationReference(),
            pluginActionDefinitionKey = "test-action-with-uri-parameter"
        )

        val execution = mock<DelegateExecution>()
        whenever(execution.processInstanceId).thenReturn(UUID.randomUUID().toString())
        whenever(execution.getVariable("exampleUrl")).thenReturn("www.example.com")

        val result = pluginService.invoke(execution, processLink)

        assertEquals(URI("www.example.com"), result)
    }

    @Test
    @Transactional
    fun `should invoke all plugin events on a plugin configuration creation, update and deletion`() {

        val pluginProperties = objectMapper.readTree(
            """
            {
                "property1": "test123",
                "property2": false,
                "property3": 123,
                "property4": "${categoryPluginConfiguration.id.id}"
            }
        """.trimMargin()
        ) as ObjectNode
        val testPlugin = spy(TestPlugin("someString"))

        doReturn(testPlugin).whenever(pluginService).createInstance(any<PluginConfiguration>())

        pluginConfiguration = pluginService.createPluginConfiguration(
            "title",
            pluginProperties,
            "test-plugin",
        )

        pluginService.updatePluginConfiguration(
            pluginConfiguration.id,
            "title",
            pluginProperties
        )

        pluginService.deletePluginConfiguration(
            pluginConfiguration.id
        )

        verify(testPlugin, atLeastOnce()).shouldRunOnCreate()
        verify(testPlugin, times(2)).shouldRunOnCreateAndDelete()
        verify(testPlugin, atLeastOnce()).shouldRunOnUpdate()
        verify(testPlugin, atLeastOnce()).shouldRunOnDelete()
    }

    @Test
    @Transactional
    fun `should throw informative exception on failure of a plugin event`() {
        val input = """
            {
                "property1": "test123",
                "property2": false,
                "property3": 123,
                "property4": "${categoryPluginConfiguration.id.id}"
            }
        """.trimMargin()
        val testPlugin = spy(TestPlugin("someString"))

        doReturn(testPlugin).whenever(pluginService).createInstance(any<PluginConfiguration>())
        doThrow(IllegalArgumentException("Wrong argument")).whenever(testPlugin).shouldRunOnCreate()

        assertFailsWith<PluginEventInvocationException> {
            pluginService.createPluginConfiguration(
                "title",
                objectMapper.readTree(input) as ObjectNode,
                "test-plugin",
            )
        }
    }

    @Test
    @Transactional
    fun `should deploy plugin with resolved properties`() {
        val pluginConfigurationId = UUID.randomUUID()
        System.setProperty("MY_URL_PLACEHOLDER", "https://www.example.com/")
        System.setProperty("MY_FIRST_PLACEHOLDER", "first_value")
        System.setProperty("MY_SECOND_PLACEHOLDER", "second_value")
        val properties = """
            {
                "property1": "${'$'}{MY_URL_PLACEHOLDER}api/v1/something",
                "property2": true,
                "property3": 3,
                "property4": [
                    {
                        "innerProperty": "start ${'$'}{MY_FIRST_PLACEHOLDER} middle ${'$'}{MY_SECOND_PLACEHOLDER} end"
                    }
                ]
            }"""

        pluginService.deployPluginConfigurations(
            PluginAutoDeploymentDto(
                id = pluginConfigurationId,
                title = "My test plugin",
                pluginDefinitionKey = "auto-deployment-test-plugin",
                properties = objectMapper.readTree(properties) as ObjectNode
            )
        )

        val pluginConfiguration = pluginService.createInstance<AutoDeploymentTestPlugin>(pluginConfigurationId)
        assertEquals(URI("https://www.example.com/api/v1/something"), pluginConfiguration.property1)
        assertEquals("start first_value middle second_value end", pluginConfiguration.property4.single().innerProperty)
    }

    @Test
    @Transactional
    fun `should update plugin configuration id`() {
        val pluginProperties = objectMapper.readTree("""{ "property1": "updated" }""") as ObjectNode
        val newPluginConfigurationId = PluginConfigurationId(UUID.fromString("ec9c12f3-5617-4184-88cc-e314dd9f4de2"))
        val update = """
            {
                "property1": "test1234",
                "property2": false,
                "property3": 123,
                "property4": "${categoryPluginConfiguration.id.id}"
            }
        """.trimMargin()
        val pluginConfigurationWithRef = pluginConfigurationRepository.save(
            PluginConfiguration(
                PluginConfigurationId.newId(),
                "title",
                objectMapper.readTree(update) as ObjectNode,
                pluginDefinition,
                encryptionService,
                objectMapper
            )
        )

        pluginService.updatePluginConfiguration(
            oldPluginConfigurationId = categoryPluginConfiguration.id,
            newPluginConfigurationId = newPluginConfigurationId,
            title = "Updated title",
            properties = pluginProperties
        )

        assertTrue(pluginConfigurationRepository.findById(categoryPluginConfiguration.id).isEmpty)
        val updatedConfiguration = pluginConfigurationRepository.findById(newPluginConfigurationId)
        assertTrue(updatedConfiguration.isPresent)
        assertEquals(updatedConfiguration.get().title, "Updated title")
        assertEquals(updatedConfiguration.get().properties!!["property1"].textValue(), "updated")
        val linkedConfiguration = pluginConfigurationRepository.findById(pluginConfigurationWithRef.id).get()
        assertEquals(linkedConfiguration.properties!!["property4"].textValue(), newPluginConfigurationId.id.toString())
    }

    @TestConfiguration
    class TestResolverConfig {
        @Bean
        fun buildingBlockPluginConfigurationResolver(): BuildingBlockPluginConfigurationResolver = TestBuildingBlockPluginConfigurationResolver()
    }

    class TestBuildingBlockPluginConfigurationResolver : BuildingBlockPluginConfigurationResolver {
        private val executionMappings = mutableMapOf<DelegateExecution, Map<String, UUID>>()

        override fun register(execution: DelegateExecution, mappings: Map<String, UUID>) {
            executionMappings[execution] = mappings
        }

        override fun resolve(execution: DelegateExecution, pluginDefinitionKey: String): UUID? {
            return executionMappings[execution]?.get(pluginDefinitionKey)
        }

        override fun resolve(task: DelegateTask, pluginDefinitionKey: String): UUID? {
            return executionMappings[task.execution]?.get(pluginDefinitionKey)
        }
    }
}
