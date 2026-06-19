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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.exception.ExternalPluginConfigurationInUseException
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
import java.util.Optional
import java.util.UUID

class ExternalPluginConfigurationServiceDeleteTest {

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var hostRepository: ExternalPluginHostRepository
    private lateinit var grantedEndpointRepository: ExternalPluginGrantedEndpointRepository
    private lateinit var grantedEventRepository: ExternalPluginGrantedEventRepository
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var encryptionService: EncryptionService
    private lateinit var hostUsageResolver: ExternalPluginHostUsageResolver
    private lateinit var service: ExternalPluginConfigurationService

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        hostRepository = mock()
        grantedEndpointRepository = mock()
        grantedEventRepository = mock()
        hostClient = mock()
        encryptionService = mock()
        hostUsageResolver = mock()
        service = ExternalPluginConfigurationService(
            configurationRepository,
            definitionRepository,
            hostRepository,
            grantedEndpointRepository,
            grantedEventRepository,
            hostClient,
            mock(),
            encryptionService,
            ObjectMapper(),
            mock(),
            hostUsageResolver,
            "valtimo-events",
            "http://localhost:8080",
        )
    }

    @Test
    fun `delete throws when usages exist and does not touch any repository or remote host`() {
        val configId = UUID.randomUUID()
        val configuration = configuration(configId)
        val usages = listOf(usageDto(configId))
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(configuration))
        whenever(hostUsageResolver.findUsagesForConfiguration(configId)).thenReturn(usages)

        assertThatThrownBy { service.delete(configId) }
            .isInstanceOf(ExternalPluginConfigurationInUseException::class.java)
            .satisfies({ thrown ->
                val problem = thrown as ExternalPluginConfigurationInUseException
                assertThat(problem.parameters["configurationId"]).isEqualTo(configId.toString())
                @Suppress("UNCHECKED_CAST")
                val payloadUsages = problem.parameters["usages"] as Collection<PluginUsageDto>
                assertThat(payloadUsages).hasSize(1)
            })

        verify(grantedEndpointRepository, never()).deleteAllByConfigurationId(any())
        verify(grantedEventRepository, never()).deleteAllByConfigurationId(any())
        verify(configurationRepository, never()).delete(any<ExternalPluginConfiguration>())
        verify(hostClient, never()).deleteConfiguration(any(), any(), any())
    }

    @Test
    fun `delete proceeds when no usages exist`() {
        val configId = UUID.randomUUID()
        val configuration = configuration(configId)
        val definition = definition(configuration.definitionId)
        val host = host(definition.hostId)
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(configuration))
        whenever(hostUsageResolver.findUsagesForConfiguration(configId)).thenReturn(emptyList())
        whenever(definitionRepository.findById(configuration.definitionId)).thenReturn(Optional.of(definition))
        whenever(hostRepository.findById(definition.hostId)).thenReturn(Optional.of(host))
        whenever(encryptionService.decrypt(any())).thenReturn("admin-token")

        service.delete(configId)

        verify(grantedEndpointRepository).deleteAllByConfigurationId(configId)
        verify(grantedEventRepository).deleteAllByConfigurationId(configId)
        verify(configurationRepository).delete(configuration)
        verify(hostClient).deleteConfiguration(host.baseUrl, "admin-token", configId.toString())
    }

    @Test
    fun `findUsages delegates to the resolver`() {
        val configId = UUID.randomUUID()
        val expected = listOf(usageDto(configId))
        whenever(hostUsageResolver.findUsagesForConfiguration(configId)).thenReturn(expected)

        val result = service.findUsages(configId)

        assertThat(result).isSameAs(expected)
        verify(configurationRepository, never()).delete(any<ExternalPluginConfiguration>())
    }

    private fun configuration(id: UUID): ExternalPluginConfiguration = ExternalPluginConfiguration(
        id = id,
        definitionId = UUID.randomUUID(),
        title = "Primary CRM",
    )

    private fun definition(id: UUID): ExternalPluginDefinition = ExternalPluginDefinition(
        id = id,
        pluginId = "test-plugin",
        version = "1.0.0",
        hostId = UUID.randomUUID(),
        baseUrl = "https://host.example",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
    )

    private fun host(id: UUID): ExternalPluginHost = ExternalPluginHost(
        id = id,
        name = "remote",
        baseUrl = "https://host.example",
        secret = "encrypted",
        status = ExternalPluginHostStatus.UNREACHABLE,
        gzacCallbackBaseUrl = "http://localhost:8080",
        eventBrokerAmqpUrl = null,
        eventBrokerExchange = null,
    )

    private fun usageDto(configurationId: UUID): PluginUsageDto = PluginUsageDto(
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
        processLinkId = UUID.randomUUID(),
    )
}
