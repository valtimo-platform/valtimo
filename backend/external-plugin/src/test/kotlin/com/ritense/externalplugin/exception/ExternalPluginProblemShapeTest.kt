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

package com.ritense.externalplugin.exception

import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.zalando.problem.Status
import java.util.UUID

/**
 * Wire shape of the remaining external-plugin problems. The in-use exception is what the
 * frontend branches on to open the read-only usage modal, and `getCause() == null` is what keeps a
 * stack trace out of the response body — both silent-breakage risks if the class is ever refactored.
 * `ExternalPluginHostInUseExceptionTest` pins the host-scoped sibling.
 */
class ExternalPluginProblemShapeTest {

    private val configurationId = UUID.randomUUID()

    private fun usage(tabKey: String? = null, widgetKey: String? = null) = PluginUsageDto(
        configurationId = configurationId,
        configurationTitle = "My configuration",
        parentType = PluginUsageParentType.CASE,
        parentKey = "my-case",
        parentVersionTag = "1.0.0",
        processDefinitionKey = if (tabKey == null && widgetKey == null) "my-process" else null,
        activityId = if (tabKey == null && widgetKey == null) "ServiceTask_1" else null,
        tabKey = tabKey,
        widgetKey = widgetKey,
    )

    @Test
    fun `configuration-in-use carries the configuration id and usages under a 409`() {
        val exception = ExternalPluginConfigurationInUseException(configurationId, listOf(usage()))

        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(exception.title).isEqualTo("External plugin configuration is in use")
        assertThat(exception.detail).contains("Remove the references before deleting")
        assertThat(exception.parameters["configurationId"]).isEqualTo(configurationId.toString())

        @Suppress("UNCHECKED_CAST")
        val usages = exception.parameters["usages"] as Collection<PluginUsageDto>
        assertThat(usages).hasSize(1)
        assertThat(usages.first().processDefinitionKey).isEqualTo("my-process")
        assertThat(usages.first().activityId).isEqualTo("ServiceTask_1")
    }

    @Test
    fun `configuration-in-use renders tab and widget usages too, not only process links`() {
        val exception = ExternalPluginConfigurationInUseException(
            configurationId,
            listOf(usage(tabKey = "summary"), usage(widgetKey = "summary-widget")),
        )

        @Suppress("UNCHECKED_CAST")
        val usages = exception.parameters["usages"] as Collection<PluginUsageDto>
        assertThat(usages.map { it.tabKey }).containsExactly("summary", null)
        assertThat(usages.map { it.widgetKey }).containsExactly(null, "summary-widget")
    }

    @Test
    fun `configuration-in-use exposes an empty usage collection rather than omitting the key`() {
        // The frontend always reads `usages`; a missing key would be an undefined-property crash.
        val exception = ExternalPluginConfigurationInUseException(configurationId, emptyList())

        assertThat(exception.parameters).containsKey("usages")

        @Suppress("UNCHECKED_CAST")
        val usages = exception.parameters["usages"] as Collection<PluginUsageDto>
        assertThat(usages).isEmpty()
    }

    @Test
    fun `configuration-in-use has no cause so no stack trace leaks into the problem body`() {
        assertThat(ExternalPluginConfigurationInUseException(configurationId, listOf(usage())).cause)
            .isNull()
    }

    @Test
    fun `not-found is a 404 problem naming the resource and id`() {
        val id = UUID.randomUUID()

        val exception = ExternalPluginNotFoundException("Configuration", id)

        assertThat(exception.status).isEqualTo(Status.NOT_FOUND)
        assertThat(exception.title).isEqualTo("Configuration not found")
        assertThat(exception.detail).isEqualTo("Configuration $id not found")
        assertThat(exception.cause).isNull()
    }

    @Test
    fun `not-found reports whichever resource kind was looked up`() {
        val id = UUID.randomUUID()

        assertThat(ExternalPluginNotFoundException("Host", id).title).isEqualTo("Host not found")
        assertThat(ExternalPluginNotFoundException("Definition", id).title)
            .isEqualTo("Definition not found")
    }
}
