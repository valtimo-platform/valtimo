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

import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.exception.ExternalPluginHostInUseException
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class ExternalPluginHostServiceDeleteTest {

    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var grantedEventRepository: ExternalPluginGrantedEventRepository
    private lateinit var hostUsageResolver: ExternalPluginHostUsageResolver
    private lateinit var service: ExternalPluginHostService

    @BeforeEach
    fun setUp() {
        hostRepository = mock()
        definitionRepository = mock()
        configurationRepository = mock()
        grantedEndpointRepository = mock()
        grantedEventRepository = mock()
        hostUsageResolver = mock()
        service = ExternalPluginHostService(
            hostRepository,
            definitionRepository,
            configurationRepository,
            grantedEndpointRepository,
            grantedEventRepository,
            mock<EncryptionService>(),
            mock<ExternalPluginHostClient>(),
            hostUsageResolver,
        )
    }

    @Test
    fun `delete throws when usages exist and does not touch any repository`() {
        val hostId = UUID.randomUUID()
        val usages = listOf(
            PluginUsageDto(
                configurationId = UUID.randomUUID(),
                configurationTitle = "Primary CRM",
                parentType = PluginUsageParentType.CASE,
                parentKey = "complaint",
                parentVersionTag = "1.0.0",
                processDefinitionId = "complaint-intake:3:abc",
                processDefinitionKey = "complaint-intake",
                processDefinitionName = "Complaint intake",
                activityId = "SendLetter",
                activityName = "Send letter to citizen",
                processLinkId = UUID.randomUUID(),
            )
        )
        whenever(hostUsageResolver.findUsagesForHost(hostId)).thenReturn(usages)

        assertThatThrownBy { service.delete(hostId) }
            .isInstanceOf(ExternalPluginHostInUseException::class.java)
            .satisfies({ thrown ->
                val problem = thrown as ExternalPluginHostInUseException
                assertThat(problem.parameters["hostId"]).isEqualTo(hostId.toString())
                @Suppress("UNCHECKED_CAST")
                val payloadUsages = problem.parameters["usages"] as Collection<PluginUsageDto>
                assertThat(payloadUsages).hasSize(1)
                assertThat(payloadUsages.first().activityName).isEqualTo("Send letter to citizen")
            })

        verify(definitionRepository, never()).findAllByHostId(any())
        verify(configurationRepository, never()).findAllByDefinitionId(any())
        verify(grantedEndpointRepository, never()).deleteAllByConfigurationId(any())
        verify(grantedEventRepository, never()).deleteAllByConfigurationId(any())
        verify(configurationRepository, never()).deleteAll(any<Iterable<ExternalPluginConfiguration>>())
        verify(definitionRepository, never()).deleteAll(any<Iterable<ExternalPluginDefinition>>())
        verify(hostRepository, never()).deleteById(any())
    }

    @Test
    fun `findUsages delegates to the resolver and never deletes`() {
        val hostId = UUID.randomUUID()
        val expected = listOf(
            PluginUsageDto(
                configurationId = UUID.randomUUID(),
                configurationTitle = "Primary CRM",
                parentType = PluginUsageParentType.GLOBAL,
                parentKey = null,
                parentVersionTag = null,
                processDefinitionId = "complaint-intake:3:abc",
                processDefinitionKey = null,
                processDefinitionName = null,
                activityId = "SendLetter",
                activityName = null,
                processLinkId = UUID.randomUUID(),
            )
        )
        whenever(hostUsageResolver.findUsagesForHost(hostId)).thenReturn(expected)

        val usages = service.findUsages(hostId)

        assertThat(usages).isSameAs(expected)
        verify(hostRepository, never()).deleteById(any())
        verify(definitionRepository, never()).deleteAll(any<Iterable<ExternalPluginDefinition>>())
    }

    @Test
    fun `delete cascades when no usages exist`() {
        val hostId = UUID.randomUUID()
        val definition = ExternalPluginDefinition(
            id = UUID.randomUUID(),
            pluginId = "test-plugin",
            version = "1.0.0",
            hostId = hostId,
            baseUrl = "https://host.example",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        val configuration = ExternalPluginConfiguration(
            id = UUID.randomUUID(),
            definitionId = definition.id,
            title = "Configuration",
        )
        whenever(hostUsageResolver.findUsagesForHost(hostId)).thenReturn(emptyList())
        whenever(definitionRepository.findAllByHostId(hostId)).thenReturn(listOf(definition))
        whenever(configurationRepository.findAllByDefinitionId(definition.id)).thenReturn(listOf(configuration))

        service.delete(hostId)

        verify(grantedEndpointRepository).deleteAllByConfigurationId(configuration.id)
        verify(grantedEventRepository).deleteAllByConfigurationId(configuration.id)
        verify(configurationRepository).deleteAll(listOf(configuration))
        verify(definitionRepository).deleteAll(listOf(definition))
        verify(hostRepository).deleteById(hostId)
    }
}
