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

package com.ritense.valtimo.processlink.mapper

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType.BUILDING_BLOCK
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.domain.PluginConfigurationReferenceType.VALUE_RESOLVER
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.plugin.web.rest.request.PluginProcessLinkUpdateDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.slf4j.LoggerFactory
import java.util.UUID

class PluginProcessLinkMapperValueResolverTest {

    private val objectMapper = jacksonObjectMapper()
    private val valueResolverService = mock<ValueResolverService>()
    private val logAppender = ListAppender<ILoggingEvent>()
    private val logger = LoggerFactory.getLogger(PluginProcessLinkMapper::class.java.packageName) as Logger
    private lateinit var mapper: PluginProcessLinkMapper

    @BeforeEach
    fun before() {
        whenever(valueResolverService.supportsValue(any())).thenAnswer { (it.arguments[0] as String).startsWith("pv:") }
        mapper = PluginProcessLinkMapper(objectMapper, mock(), mock(), mock(), valueResolverService)
        logAppender.start()
        logger.addAppender(logAppender)
    }

    @AfterEach
    fun after() {
        logger.detachAppender(logAppender)
    }

    @Test
    fun `a pluginConfigurationId that is not a UUID is read as a VALUE_RESOLVER expression`() {
        val deployDto = deploy(""""pluginConfigurationId": "pv:pluginConfigId", "pluginDefinitionKey": "test-plugin"""")

        assertThat(deployDto.pluginConfigurationId).isNull()
        assertThat(deployDto.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(deployDto.referenceType).isEqualTo(VALUE_RESOLVER)

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)
        assertThat(createDto.referenceType).isEqualTo(VALUE_RESOLVER)
        assertThat(createDto.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(createDto.pluginConfigurationId).isNull()
    }

    @Test
    fun `the explicit expression field is accepted as written by an export`() {
        val deployDto = deploy(
            """"pluginConfigurationId": null, "referenceType": "VALUE_RESOLVER", "pluginDefinitionKey": "test-plugin",
               "pluginConfigurationIdExpression": "pv:pluginConfigId""""
        )

        assertThat(deployDto.referenceType).isEqualTo(VALUE_RESOLVER)
        assertThat(deployDto.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
    }

    @Test
    fun `a UUID pluginConfigurationId is read as before`() {
        val id = UUID.randomUUID()
        val deployDto = deploy(""""pluginConfigurationId": "$id"""")

        assertThat(deployDto.pluginConfigurationId).isEqualTo(id)
        assertThat(deployDto.pluginConfigurationIdExpression).isNull()
        assertThat(deployDto.referenceType).isEqualTo(FIXED)
        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)
        assertThat(createDto.pluginConfigurationId).isEqualTo(id)
        assertThat(createDto.referenceType).isEqualTo(FIXED)
        assertThat(logAppender.list).isEmpty()
    }

    @Test
    fun `a building block link keeps its reference type`() {
        val deployDto = deploy(""""referenceType": "BUILDING_BLOCK", "pluginDefinitionKey": "test-plugin"""")

        assertThat(deployDto.referenceType).isEqualTo(BUILDING_BLOCK)
        assertThat(deployDto.pluginConfigurationIdExpression).isNull()
    }

    @Test
    fun `an unresolved placeholder in pluginConfigurationId is logged and stored as a dangling link`() {
        val deployDto = deploy(""""pluginConfigurationId": "${'$'}{GZAC_ZAKEN_CONFIG_ID}", "pluginDefinitionKey": "test-plugin"""")

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)

        assertThat(createDto.referenceType).isEqualTo(FIXED)
        assertThat(createDto.pluginConfigurationId).isNull()
        assertThat(createDto.pluginConfigurationIdExpression).isNull()
        assertThat(createDto.pluginDefinitionKey).isEqualTo("test-plugin")
        assertThat(errors()).singleElement().satisfies({ message ->
            assertThat(message)
                .contains("activity 'Task'")
                .contains("pluginConfigurationId")
                .contains("'GZAC_ZAKEN_CONFIG_ID'")
                .contains("valtimo.import.whitelistedPaths")
        })
    }

    @Test
    fun `an unresolved placeholder in pluginActionDefinitionKey is logged and stored as written`() {
        val deployDto = deploy(""""pluginConfigurationId": "${UUID.randomUUID()}"""", actionKey = "${'$'}{valtimo.missing-action}")

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)

        assertThat(createDto.pluginActionDefinitionKey).isEqualTo("${'$'}{valtimo.missing-action}")
        assertThat(errors()).singleElement().satisfies({ message ->
            assertThat(message)
                .contains("activity 'Task'")
                .contains("pluginActionDefinitionKey")
                .contains("'valtimo.missing-action'")
                .contains("valtimo.import.whitelistedPaths")
        })
    }

    @Test
    fun `a pluginConfigurationId that is neither a UUID nor a supported value is logged and stored as a dangling link`() {
        val deployDto = deploy(""""pluginConfigurationId": "unknown:value", "pluginDefinitionKey": "test-plugin"""")

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)

        assertThat(createDto.referenceType).isEqualTo(FIXED)
        assertThat(createDto.pluginConfigurationId).isNull()
        assertThat(createDto.pluginConfigurationIdExpression).isNull()
        assertThat(errors()).singleElement().satisfies({ message ->
            assertThat(message).contains("activity 'Task'").contains("pluginConfigurationId").contains("'unknown:value'")
        })
    }

    @Test
    fun `a value-resolver pluginConfigurationId without pluginDefinitionKey is rejected naming both fields`() {
        val deployDto = deploy(""""pluginConfigurationId": "pv:pluginConfigId"""")

        assertThatThrownBy { mapper.toProcessLinkCreateRequestDto(deployDto, null) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("pluginConfigurationId 'pv:pluginConfigId'")
            .hasMessageContaining("requires pluginDefinitionKey")
            .hasMessageContaining("environment placeholder")
    }

    @Test
    fun `an update that omits the expression keeps the stored one`() {
        val stored = PluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process:1",
            activityId = "Task",
            activityType = SERVICE_TASK_START,
            pluginConfigurationReference = PluginConfigurationReference(VALUE_RESOLVER, "test-plugin"),
            pluginActionDefinitionKey = "test-action",
            pluginConfigurationIdExpression = "pv:pluginConfigId",
        )
        val update = PluginProcessLinkUpdateDto(
            id = stored.id,
            pluginActionDefinitionKey = "test-action",
            actionProperties = objectMapper.createObjectNode().put("note", "changed"),
            referenceType = VALUE_RESOLVER,
        )

        val updated = mapper.toUpdatedProcessLink(stored, update, null)

        assertThat(updated.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(updated.pluginConfigurationReference).isEqualTo(stored.pluginConfigurationReference)
        assertThat(updated.actionProperties?.path("note")?.asText()).isEqualTo("changed")
    }

    @Test
    fun `the API rejects a VALUE_RESOLVER link with an unsupported expression`() {
        val createDto = PluginProcessLinkCreateDto(
            processDefinitionId = "process:1",
            activityId = "Task",
            pluginActionDefinitionKey = "test-action",
            activityType = SERVICE_TASK_START,
            referenceType = VALUE_RESOLVER,
            pluginDefinitionKey = "test-plugin",
            pluginConfigurationIdExpression = "not-supported",
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("not supported by any value resolver")
    }

    private fun errors() = logAppender.list.filter { it.level == Level.ERROR }.map { it.formattedMessage }

    private fun deploy(fields: String, actionKey: String = "test-action"): PluginProcessLinkDeployDto {
        return objectMapper.copy().also { PluginProcessLinkMapper(it, mock(), mock(), mock()) }
            .readValue<ProcessLinkDeployDto>(
                """
                {
                    "processLinkType": "plugin",
                    "processDefinitionId": "process:1",
                    "activityId": "Task",
                    "activityType": "bpmn:ServiceTask:start",
                    "pluginActionDefinitionKey": "$actionKey",
                    $fields
                }
                """.trimIndent()
            ) as PluginProcessLinkDeployDto
    }
}
