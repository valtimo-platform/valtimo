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

import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkUpdateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkUpdateRequestDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import java.util.UUID

/**
 * The process-link framework resolves the concrete subtype of a create/update request by Jackson
 * DEDUCTION (`@JsonTypeInfo(use = DEDUCTION)`: which fields are present, not an explicit
 * `processLinkType`). The external-plugin service-task action link is identified by its `actionKey`,
 * the task-form link by its `bundleKey`. Because every other field of the task-form link is a strict
 * subset of the action link's, `bundleKey` MUST always be serialised (even as null) for the task-form
 * to stay distinguishable — the frontend upholds this. These tests lock that contract so a later field
 * change can't silently make the two links ambiguous.
 */
class ExternalPluginProcessLinkTypeDeductionTest {

    // Register both mappers' subtypes on one ObjectMapper, exactly as the auto-configuration does, so
    // deduction sees the same candidate set as at runtime.
    private val mapper = MapperSingleton.get().copy().also {
        ExternalPluginProcessLinkMapper(it, mock(), mock(), mock())
        ExternalPluginTaskFormProcessLinkMapper(it, mock(), mock(), mock())
    }

    @Test
    fun `deduces the action create request from its actionKey`() {
        val dto: ProcessLinkCreateRequestDto = mapper.readValue(
            """
            {
                "processDefinitionId": "pd-1",
                "activityId": "SendLetter",
                "activityType": "${ActivityTypeWithEventName.SERVICE_TASK_START.value}",
                "externalPluginConfigurationId": "${UUID.randomUUID()}",
                "actionKey": "send",
                "pluginVersion": "1.0.0"
            }
            """.trimIndent()
        )

        assertThat(dto).isInstanceOf(ExternalPluginProcessLinkCreateRequestDto::class.java)
    }

    @Test
    fun `deduces the task-form create request from its bundleKey`() {
        val dto: ProcessLinkCreateRequestDto = mapper.readValue(
            """
            {
                "processDefinitionId": "pd-1",
                "activityId": "ReviewTask",
                "activityType": "${ActivityTypeWithEventName.USER_TASK_CREATE.value}",
                "externalPluginConfigurationId": "${UUID.randomUUID()}",
                "pluginVersion": "1.0.0",
                "bundleKey": "review"
            }
            """.trimIndent()
        )

        assertThat(dto).isInstanceOf(ExternalPluginTaskFormProcessLinkCreateRequestDto::class.java)
    }

    @Test
    fun `deduces the task-form create request even when the bundleKey is null`() {
        val dto: ProcessLinkCreateRequestDto = mapper.readValue(
            """
            {
                "processDefinitionId": "pd-1",
                "activityId": "ReviewTask",
                "activityType": "${ActivityTypeWithEventName.USER_TASK_CREATE.value}",
                "externalPluginConfigurationId": "${UUID.randomUUID()}",
                "pluginVersion": "1.0.0",
                "bundleKey": null
            }
            """.trimIndent()
        )

        assertThat(dto).isInstanceOf(ExternalPluginTaskFormProcessLinkCreateRequestDto::class.java)
        assertThat((dto as ExternalPluginTaskFormProcessLinkCreateRequestDto).bundleKey).isNull()
    }

    @Test
    fun `omitting the bundleKey makes the task-form create request indistinguishable from the action link`() {
        // Without bundleKey the payload's fields are a subset of the action link's, so deduction can
        // never resolve the task-form subtype from them — this is precisely why the frontend always
        // serialises bundleKey. Depending on the candidate set Jackson either fails or resolves to the
        // action link, but never silently to the task-form.
        val result = runCatching {
            mapper.readValue<ProcessLinkCreateRequestDto>(
                """
                {
                    "processDefinitionId": "pd-1",
                    "activityId": "ReviewTask",
                    "activityType": "${ActivityTypeWithEventName.USER_TASK_CREATE.value}",
                    "externalPluginConfigurationId": "${UUID.randomUUID()}",
                    "pluginVersion": "1.0.0"
                }
                """.trimIndent()
            )
        }.getOrNull()

        assertThat(result is ExternalPluginTaskFormProcessLinkCreateRequestDto).isFalse()
    }

    @Test
    fun `deduces the action update request from its actionKey`() {
        val dto: ProcessLinkUpdateRequestDto = mapper.readValue(
            """
            {
                "id": "${UUID.randomUUID()}",
                "externalPluginConfigurationId": "${UUID.randomUUID()}",
                "actionKey": "send",
                "pluginVersion": "1.0.0"
            }
            """.trimIndent()
        )

        assertThat(dto).isInstanceOf(ExternalPluginProcessLinkUpdateRequestDto::class.java)
    }

    @Test
    fun `deduces the task-form update request from its bundleKey`() {
        val dto: ProcessLinkUpdateRequestDto = mapper.readValue(
            """
            {
                "id": "${UUID.randomUUID()}",
                "externalPluginConfigurationId": "${UUID.randomUUID()}",
                "pluginVersion": "1.0.0",
                "bundleKey": null
            }
            """.trimIndent()
        )

        assertThat(dto).isInstanceOf(ExternalPluginTaskFormProcessLinkUpdateRequestDto::class.java)
    }
}
