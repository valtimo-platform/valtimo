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

package com.ritense.externalplugin.service

import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.FlowElement
import java.util.UUID

class ExternalPluginHostUsageResolverTest {

    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var processLinkRepository: ExternalPluginProcessLinkRepository
    private lateinit var operatonRepositoryService: OperatonRepositoryService
    private lateinit var bpmnRepositoryService: RepositoryService
    private lateinit var resolver: ExternalPluginHostUsageResolver

    @BeforeEach
    fun setUp() {
        definitionRepository = mock()
        configurationRepository = mock()
        processLinkRepository = mock()
        operatonRepositoryService = mock()
        bpmnRepositoryService = mock()
        resolver = ExternalPluginHostUsageResolver(
            definitionRepository,
            configurationRepository,
            processLinkRepository,
            operatonRepositoryService,
            bpmnRepositoryService,
            java.util.Optional.empty(),
        )
    }

    @Test
    fun `host with no definitions returns empty list`() {
        val hostId = UUID.randomUUID()
        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(emptyList())

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).isEmpty()
        verify(processLinkRepository, never()).findAllByExternalPluginConfigurationIdIn(any())
    }

    @Test
    fun `host with definitions but no configurations returns empty list`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(emptyList())

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).isEmpty()
        verify(processLinkRepository, never()).findAllByExternalPluginConfigurationIdIn(any())
    }

    @Test
    fun `configuration present but no process links returns empty list`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id)
        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(emptyList())

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).isEmpty()
    }

    @Test
    fun `process tied to a case definition is classified as CASE`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id, title = "Primary CRM")
        val processDefId = "bezwaar:3:abc"
        val link = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "SendLetter",
        )

        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(link))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId)).thenReturn(
            operatonProcessDefinition(
                id = processDefId,
                key = "bezwaar",
                name = "Bezwaarprocedure",
                versionTag = "CD:bezwaar:1.0.1",
            )
        )
        val model = bpmnModelWithActivity("SendLetter", "Send letter to citizen")
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId)).thenReturn(model)

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.parentType).isEqualTo(PluginUsageParentType.CASE)
        assertThat(usage.parentKey).isEqualTo("bezwaar")
        assertThat(usage.parentVersionTag).isEqualTo("1.0.1")
        assertThat(usage.processDefinitionKey).isEqualTo("bezwaar")
        assertThat(usage.processDefinitionName).isEqualTo("Bezwaarprocedure")
        assertThat(usage.activityName).isEqualTo("Send letter to citizen")
    }

    @Test
    fun `process tied to a building block is classified as BUILDING_BLOCK`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id)
        val processDefId = "send-notification:2:bb-hash"
        val link = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "PostMessage",
        )

        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(link))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId)).thenReturn(
            operatonProcessDefinition(
                id = processDefId,
                key = "send-notification",
                name = "Send notification",
                versionTag = "BB:send-notification:2.0.0",
            )
        )
        val model = bpmnModelWithActivity("PostMessage", "Post status update")
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId)).thenReturn(model)

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.parentType).isEqualTo(PluginUsageParentType.BUILDING_BLOCK)
        assertThat(usage.parentKey).isEqualTo("send-notification")
        assertThat(usage.parentVersionTag).isEqualTo("2.0.0")
        assertThat(usage.processDefinitionKey).isEqualTo("send-notification")
        assertThat(usage.processDefinitionName).isEqualTo("Send notification")
    }

    @Test
    fun `process with no version tag prefix is classified as GLOBAL`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id)
        val processDefId = "global-housekeeping:1:xyz"
        val link = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "Cleanup",
        )

        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(link))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId)).thenReturn(
            operatonProcessDefinition(
                id = processDefId,
                key = "global-housekeeping",
                name = "Global housekeeping",
                versionTag = null,
            )
        )
        val model = bpmnModelWithActivity("Cleanup", "Cleanup step")
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId)).thenReturn(model)

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.parentType).isEqualTo(PluginUsageParentType.GLOBAL)
        assertThat(usage.parentKey).isNull()
        assertThat(usage.parentVersionTag).isNull()
        assertThat(usage.processDefinitionKey).isEqualTo("global-housekeeping")
        assertThat(usage.processDefinitionName).isEqualTo("Global housekeeping")
    }

    @Test
    fun `process definition lookup failure degrades to GLOBAL with nullable fields`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id, title = "Broken Reference")
        val processDefId = "missing:9:no-such"
        val link = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "Unknown",
        )

        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(link))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId))
            .thenThrow(RuntimeException("process definition gone"))
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId))
            .thenThrow(RuntimeException("model gone"))

        val usages = resolver.findUsagesForHost(hostId)

        assertThat(usages).hasSize(1)
        val usage = usages[0]
        assertThat(usage.parentType).isEqualTo(PluginUsageParentType.GLOBAL)
        assertThat(usage.parentKey).isNull()
        assertThat(usage.parentVersionTag).isNull()
        assertThat(usage.processDefinitionKey).isNull()
        assertThat(usage.processDefinitionName).isNull()
        assertThat(usage.activityName).isNull()
        assertThat(usage.configurationId).isEqualTo(configuration.id)
        assertThat(usage.processDefinitionId).isEqualTo(processDefId)
        assertThat(usage.activityId).isEqualTo("Unknown")
    }

    @Test
    fun `findUsagesForConfiguration returns links targeting only that configuration`() {
        val configuration = configuration(definitionId = UUID.randomUUID(), title = "Primary CRM")
        val processDefId = "bezwaar:3:abc"
        val link = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "SendLetter",
        )

        whenever(configurationRepository.findById(configuration.id))
            .thenReturn(java.util.Optional.of(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(link))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId)).thenReturn(
            operatonProcessDefinition(
                id = processDefId,
                key = "bezwaar",
                name = "Bezwaarprocedure",
                versionTag = "CD:bezwaar:1.0.1",
            )
        )
        val model = bpmnModelWithActivity("SendLetter", "Send letter to citizen")
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId)).thenReturn(model)

        val usages = resolver.findUsagesForConfiguration(configuration.id)

        assertThat(usages).hasSize(1)
        assertThat(usages[0].configurationId).isEqualTo(configuration.id)
        assertThat(usages[0].parentType).isEqualTo(PluginUsageParentType.CASE)
    }

    @Test
    fun `findUsagesForConfiguration returns empty when the configuration is unknown`() {
        val missingId = UUID.randomUUID()
        whenever(configurationRepository.findById(missingId)).thenReturn(java.util.Optional.empty())

        val usages = resolver.findUsagesForConfiguration(missingId)

        assertThat(usages).isEmpty()
        verify(processLinkRepository, never()).findAllByExternalPluginConfigurationIdIn(any())
    }

    @Test
    fun `findUsagesForConfiguration returns empty when no process links reference it`() {
        val configuration = configuration(definitionId = UUID.randomUUID())
        whenever(configurationRepository.findById(configuration.id))
            .thenReturn(java.util.Optional.of(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(emptyList())

        val usages = resolver.findUsagesForConfiguration(configuration.id)

        assertThat(usages).isEmpty()
    }

    @Test
    fun `process metadata is cached across links pointing at the same process definition`() {
        val hostId = UUID.randomUUID()
        val definition = definition(hostId = hostId)
        val configuration = configuration(definitionId = definition.id)
        val processDefId = "bezwaar:3:abc"
        val linkA = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "StepA",
        )
        val linkB = processLink(
            externalPluginConfigurationId = configuration.id,
            processDefinitionId = processDefId,
            activityId = "StepB",
        )

        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))
        whenever(processLinkRepository.findAllByExternalPluginConfigurationIdIn(setOf(configuration.id)))
            .thenReturn(listOf(linkA, linkB))
        whenever(operatonRepositoryService.findProcessDefinitionById(processDefId)).thenReturn(
            operatonProcessDefinition(
                id = processDefId,
                key = "bezwaar",
                name = "Bezwaarprocedure",
                versionTag = "CD:bezwaar:1.0.1",
            )
        )
        val model = mock<BpmnModelInstance>()
        whenever(bpmnRepositoryService.getBpmnModelInstance(processDefId)).thenReturn(model)

        resolver.findUsagesForHost(hostId)

        verify(operatonRepositoryService).findProcessDefinitionById(processDefId)
        verify(bpmnRepositoryService).getBpmnModelInstance(processDefId)
    }

    private fun definition(hostId: UUID): ExternalPluginDefinition = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = "test-plugin",
        version = "1.0.0",
        hostId = hostId,
        baseUrl = "https://host.example",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
    )

    private fun configuration(definitionId: UUID, title: String = "Configuration"): ExternalPluginConfiguration =
        ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definitionId,
            title = title,
        )

    private fun processLink(
        externalPluginConfigurationId: UUID,
        processDefinitionId: String,
        activityId: String,
    ): ExternalPluginProcessLink = ExternalPluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
        externalPluginConfigurationId = externalPluginConfigurationId,
        actionKey = "action",
        pluginVersion = "1.0.0",
    )

    private fun operatonProcessDefinition(
        id: String,
        key: String,
        name: String?,
        versionTag: String?,
    ): OperatonProcessDefinition = OperatonProcessDefinition(
        id = id,
        revision = 1,
        category = null,
        name = name,
        key = key,
        version = 1,
        deploymentId = null,
        resourceName = null,
        diagramResourceName = null,
        hasStartFormKey = false,
        suspensionState = 1,
        tenantId = null,
        versionTag = versionTag,
        historyTimeToLive = null,
        isStartableInTasklist = true,
    )

    private fun bpmnModelWithActivity(activityId: String, activityName: String): BpmnModelInstance {
        val element = mock<FlowElement> {
            on { name } doReturn activityName
        }
        return mock<BpmnModelInstance> {
            on { getModelElementById<FlowElement>(activityId) } doReturn element
        }
    }
}
