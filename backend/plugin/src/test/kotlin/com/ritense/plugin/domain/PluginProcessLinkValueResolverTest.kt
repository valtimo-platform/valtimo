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

import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.domain.PluginConfigurationReferenceType.VALUE_RESOLVER
import com.ritense.processlink.domain.ActivityTypeWithEventName.SERVICE_TASK_START
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.util.UUID

class PluginProcessLinkValueResolverTest {

    @Test
    fun `copying a link to a new process definition keeps the expression`() {
        val link = valueResolverLink("pv:pluginConfigId")

        val copied = link.copy(UUID.randomUUID(), "process:2")

        assertThat(copied.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(copied.pluginConfigurationReference.type).isEqualTo(VALUE_RESOLVER)
        assertThat(copied.processDefinitionId).isEqualTo("process:2")
    }

    @Test
    fun `links that differ only in their expression are not equal`() {
        val link = valueResolverLink("pv:pluginConfigId")
        val changed = link.copy(pluginConfigurationIdExpression = "pv:otherConfigId")

        assertThat(changed).isNotEqualTo(link)
        assertThat(changed.hashCode()).isNotEqualTo(link.hashCode())
        assertThat(link.copy(id = link.id)).isEqualTo(link)
    }

    @Test
    fun `a VALUE_RESOLVER link requires an expression and no configuration id`() {
        assertThatThrownBy { valueResolverLink(null) }
            .hasMessageContaining("pluginConfigurationIdExpression is required")
        assertThatThrownBy {
            valueResolverLink("pv:pluginConfigId").copy(pluginConfigurationId = PluginConfigurationId.newId())
        }.hasMessageContaining("pluginConfigurationId must not be set")
    }

    @Test
    fun `an expression is only allowed on a VALUE_RESOLVER link`() {
        assertThatThrownBy {
            valueResolverLink("pv:pluginConfigId").copy(pluginConfigurationReference = PluginConfigurationReference(FIXED))
        }.hasMessageContaining("only be set when reference type is VALUE_RESOLVER")
    }

    @Test
    fun `VALUE_RESOLVER requires pluginDefinitionKey`() {
        assertThatThrownBy { PluginConfigurationReference(VALUE_RESOLVER, null) }
            .hasMessageContaining("pluginDefinitionKey is required when reference type is VALUE_RESOLVER")
    }

    private fun valueResolverLink(expression: String?) = PluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "process:1",
        activityId = "task",
        activityType = SERVICE_TASK_START,
        pluginConfigurationReference = PluginConfigurationReference(VALUE_RESOLVER, "test-plugin"),
        pluginActionDefinitionKey = "test-action",
        pluginConfigurationIdExpression = expression,
    )
}
