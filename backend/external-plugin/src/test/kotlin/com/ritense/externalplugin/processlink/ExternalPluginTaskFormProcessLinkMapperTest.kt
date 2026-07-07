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

package com.ritense.externalplugin.processlink

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class ExternalPluginTaskFormProcessLinkMapperTest {

    private val mapper = ExternalPluginTaskFormProcessLinkMapper(ObjectMapper())

    @Test
    fun `supports only the task-form link type`() {
        assertThat(mapper.supportsProcessLinkType("external_plugin_task_form")).isTrue()
        assertThat(mapper.supportsProcessLinkType("external_plugin")).isFalse()
        assertThat(mapper.supportsProcessLinkType("form")).isFalse()
    }

    @Test
    fun `maps a create request to a new process link`() {
        val configId = UUID.randomUUID()
        val createDto = ExternalPluginTaskFormProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            pluginVersion = "0.1.0",
            bundleKey = "review",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(processLink.processDefinitionId).isEqualTo("pd-1")
        assertThat(processLink.activityId).isEqualTo("activity-1")
        assertThat(processLink.activityType).isEqualTo(ActivityTypeWithEventName.USER_TASK_CREATE)
        assertThat(processLink.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(processLink.pluginVersion).isEqualTo("0.1.0")
        assertThat(processLink.bundleKey).isEqualTo("review")
        assertThat(processLink.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps a process link to a response dto`() {
        val id = UUID.randomUUID()
        val configId = UUID.randomUUID()
        val processLink = ExternalPluginTaskFormProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            bundleKey = "review",
            pluginVersion = "0.1.0",
        )

        val dto = mapper.toProcessLinkResponseDto(processLink) as ExternalPluginTaskFormProcessLinkResponseDto

        assertThat(dto.id).isEqualTo(id)
        assertThat(dto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(dto.bundleKey).isEqualTo("review")
        assertThat(dto.pluginVersion).isEqualTo("0.1.0")
        assertThat(dto.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps an update request onto the existing process link`() {
        val id = UUID.randomUUID()
        val existing = ExternalPluginTaskFormProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = UUID.randomUUID(),
            bundleKey = "review",
            pluginVersion = "0.1.0",
        )
        val newConfigId = UUID.randomUUID()
        val updateDto = ExternalPluginTaskFormProcessLinkUpdateRequestDto(
            id = id,
            externalPluginConfigurationId = newConfigId,
            pluginVersion = "0.2.0",
            bundleKey = "approve",
        )

        val updated = mapper.toUpdatedProcessLink(existing, updateDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(updated.id).isEqualTo(id)
        assertThat(updated.processDefinitionId).isEqualTo("pd-1")
        assertThat(updated.activityId).isEqualTo("activity-1")
        assertThat(updated.externalPluginConfigurationId).isEqualTo(newConfigId)
        assertThat(updated.pluginVersion).isEqualTo("0.2.0")
        assertThat(updated.bundleKey).isEqualTo("approve")
    }
}
