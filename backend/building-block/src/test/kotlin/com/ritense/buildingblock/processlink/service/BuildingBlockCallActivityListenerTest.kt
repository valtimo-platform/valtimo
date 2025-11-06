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

package com.ritense.buildingblock.processlink.service

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import java.util.UUID

class BuildingBlockCallActivityListenerTest {

    private val processLinkService = mock<ProcessLinkService>()
    private val resolver = mock<BuildingBlockPluginConfigurationResolver>()

    @Test
    fun `should register mappings when listener is triggered`() {
        val listener = BuildingBlockCallActivityListener(processLinkService, resolver)
        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
        }
        val link = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0"),
            pluginConfigurationMappings = mapOf("zaken" to UUID.randomUUID())
        )
        whenever(processLinkService.getProcessLinks("case-process", "callActivity")).thenReturn(listOf(link))

        listener.onCallActivityStart(execution)

        verify(resolver).register(execution, link.pluginConfigurationMappings)
    }

    @Test
    fun `should do nothing when resolver unavailable`() {
        val listener = BuildingBlockCallActivityListener(processLinkService, null)
        val execution = mock<DelegateExecution>()

        listener.onCallActivityStart(execution)

        verify(processLinkService, never()).getProcessLinks(any(), any())
    }
}
