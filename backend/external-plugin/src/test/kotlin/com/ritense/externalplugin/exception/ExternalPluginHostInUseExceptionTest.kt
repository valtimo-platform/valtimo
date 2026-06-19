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
 * The `parameters` map on `AbstractThrowableProblem` is rendered as top-level keys on the
 * `application/problem+json` body by Zalando's `ProblemModule`, alongside `title`, `status`, and
 * `detail`. This test pins the shape of those parameters so the frontend contract cannot drift
 * silently.
 */
class ExternalPluginHostInUseExceptionTest {

    @Test
    fun `carries hostId and usages alongside conflict status and human-readable title`() {
        val hostId = UUID.randomUUID()
        val configurationId = UUID.randomUUID()
        val processLinkId = UUID.randomUUID()
        val usage = PluginUsageDto(
            configurationId = configurationId,
            configurationTitle = "Primary CRM",
            parentType = PluginUsageParentType.CASE,
            parentKey = "complaint",
            parentVersionTag = "1.0.0",
            processDefinitionId = "complaint-intake:3:abc",
            processDefinitionKey = "complaint-intake",
            processDefinitionName = "Complaint intake",
            activityId = "SendLetter",
            activityName = "Send letter to citizen",
            processLinkId = processLinkId,
        )

        val exception = ExternalPluginHostInUseException(hostId, listOf(usage))

        assertThat(exception.title).isEqualTo("External plugin host is in use")
        assertThat(exception.status).isEqualTo(Status.CONFLICT)
        assertThat(exception.detail).contains("BPMN process links reference")

        assertThat(exception.parameters).containsEntry("hostId", hostId.toString())

        @Suppress("UNCHECKED_CAST")
        val payloadUsages = exception.parameters["usages"] as Collection<PluginUsageDto>
        assertThat(payloadUsages).hasSize(1)
        val rendered = payloadUsages.first()
        assertThat(rendered.configurationId).isEqualTo(configurationId)
        assertThat(rendered.configurationTitle).isEqualTo("Primary CRM")
        assertThat(rendered.parentType).isEqualTo(PluginUsageParentType.CASE)
        assertThat(rendered.parentKey).isEqualTo("complaint")
        assertThat(rendered.parentVersionTag).isEqualTo("1.0.0")
        assertThat(rendered.processDefinitionId).isEqualTo("complaint-intake:3:abc")
        assertThat(rendered.processDefinitionKey).isEqualTo("complaint-intake")
        assertThat(rendered.processDefinitionName).isEqualTo("Complaint intake")
        assertThat(rendered.activityId).isEqualTo("SendLetter")
        assertThat(rendered.activityName).isEqualTo("Send letter to citizen")
        assertThat(rendered.processLinkId).isEqualTo(processLinkId)
    }

    @Test
    fun `cause is null so it does not leak into the problem body`() {
        val exception = ExternalPluginHostInUseException(UUID.randomUUID(), emptyList())
        assertThat(exception.cause).isNull()
    }
}
