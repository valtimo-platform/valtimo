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

package com.ritense.notificatiesapi

import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.exception.NotificatiesApiAbonnementException
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.events.PluginConfigurationCreatedEvent
import com.ritense.plugin.events.PluginConfigurationDeletedEvent
import com.ritense.plugin.events.PluginConfigurationUpdatedEvent
import com.ritense.plugin.service.PluginService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.boot.test.system.CapturedOutput
import org.springframework.boot.test.system.OutputCaptureExtension
import java.net.URI
import java.util.Optional
import java.util.UUID

@ExtendWith(OutputCaptureExtension::class)
class PluginsDeployedEventListenerTest {
    lateinit var client: NotificatiesApiClient
    lateinit var notificatiesApiAbonnementLinkRepository: NotificatiesApiAbonnementLinkRepository
    lateinit var pluginService: PluginService
    lateinit var pluginsDeployedEventListener: PluginsDeployedEventListener

    @BeforeEach
    fun setup() {
        client = mock()
        notificatiesApiAbonnementLinkRepository = mock()
        pluginService = mock()

        pluginsDeployedEventListener = PluginsDeployedEventListener(
            client = client,
            notificatiesApiAbonnementLinkRepository = notificatiesApiAbonnementLinkRepository,
            pluginService = pluginService,
            registerAbonnementen = true
        )
    }

    @Test
    fun `should register nothing`() {
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(emptyList())

        assertDoesNotThrow { pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins() }
    }

    @Test
    fun `should shutdown due to inability to connect to abonnementen api`(output: CapturedOutput) {
        val pluginInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        whenever(client.getAbonnementen(any(), any()))
            .thenThrow(RuntimeException("Connection refused"))
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(NotificatiesApiConfigurationId.existingId(UUID.fromString("123e4567-e89b-12d3-a456-426614174000")))
        whenever(pluginInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(pluginInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))

        assertThrows<NotificatiesApiAbonnementException> {
            pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()
        }

        assertThat(output).contains("Failed to register abonnementen after 3 attempts")
        assertThat(output).contains("123e4567-e89b-12d3-a456-426614174000")
    }


    @Test
    fun `should delete old abonnement that API does not have`(output: CapturedOutput) {
        val listenerInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = "http://localhost:9999/nothing/123",
            auth = "test"
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(emptyList())
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI("http://localhost:9999/callback"))
        whenever(notificatiesApiPlugin.authHeader)
            .thenReturn("12345")
        whenever(client.createAbonnement(any(), any(), any<Abonnement>()))
            .thenReturn(Abonnement(
                url = "http://localhost:9999/nothing/456",
                callbackUrl = "http://localhost:9999/callback",
                auth = "test",
                kanalen = emptyList()
            ))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(notificatiesApiAbonnementLinkRepository).delete(any())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
        verify(client).createAbonnement(any(), any(), any<Abonnement>())

        assertThat(output).contains("Successfully created abonnement with id '456'")
        assertThat(output).contains("123e4567-e89b-12d3-a456-426614174000")
    }

    @Test
    fun `should delete old abonnement that API does not have with a random header secret`() {
        val listenerInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = "http://localhost:9999/nothing/123",
            auth = "test"
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(emptyList())
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI("http://localhost:9999/callback"))
        whenever(client.createAbonnement(any(), any(), any<Abonnement>()))
            .thenReturn(Abonnement(
                url = "http://localhost:9999/nothing/456",
                callbackUrl = "http://localhost:9999/callback",
                auth = "test",
                kanalen = emptyList()
            ))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(notificatiesApiAbonnementLinkRepository).delete(any())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
        verify(client).createAbonnement(
            authentication = any(),
            baseUrl = any(),
            abonnement = any<Abonnement>()
        )
    }

    @Test
    fun `should skip update when abonnement is unchanged`() {
        val listenerInstance: NotificatiesApiListener = mock()
        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val abonnementUrl = "http://localhost:9999/nothing/123"
        val callbackUrl = "http://localhost:9999/callback"
        val kanalen = listOf(
            Abonnement.Kanaal(naam = "zaken", filters = mapOf("bron" to "082096752011")),
            Abonnement.Kanaal(naam = "documenten")
        )

        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = abonnementUrl,
            auth = "test"
        )
        val existingAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = callbackUrl,
            auth = null,
            kanalen = kanalen
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any()))
            .thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any()))
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader)
            .thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters())
            .thenReturn(kanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client, never()).updateAbonnement(
            authentication = any(),
            baseUrl = any(),
            abonnementId = any(),
            abonnement = any<Abonnement>()
        )
        verify(notificatiesApiAbonnementLinkRepository).save(any())
    }

    @Test
    fun `should update abonnement when kanalen have changed`(output: CapturedOutput) {
        val listenerInstance: NotificatiesApiListener = mock()
        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val abonnementUrl = "http://localhost:9999/nothing/123"
        val callbackUrl = "http://localhost:9999/callback"
        val remoteKanalen = listOf(Abonnement.Kanaal(naam = "zaken"))
        val desiredKanalen = listOf(
            Abonnement.Kanaal(naam = "zaken"),
            Abonnement.Kanaal(naam = "documenten")
        )

        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = abonnementUrl,
            auth = "test"
        )
        val existingAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = callbackUrl,
            auth = null,
            kanalen = remoteKanalen
        )
        val updatedAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = callbackUrl,
            auth = "12345",
            kanalen = desiredKanalen
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any()))
            .thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any()))
            .thenReturn(mock())
        whenever(client.updateAbonnement(any(), any(), any(), any<Abonnement>()))
            .thenReturn(updatedAbonnement)
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader)
            .thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters())
            .thenReturn(desiredKanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client).updateAbonnement(
            authentication = any(),
            baseUrl = any(),
            abonnementId = eq("123"),
            abonnement = any<Abonnement>()
        )
        verify(notificatiesApiAbonnementLinkRepository).save(any())

        assertThat(output).contains("Successfully updated abonnement with id '123'")
        assertThat(output).contains("123e4567-e89b-12d3-a456-426614174000")
    }

    @Test
    fun `should update abonnement when callbackUrl has changed`() {
        val listenerInstance: NotificatiesApiListener = mock()
        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val abonnementUrl = "http://localhost:9999/nothing/123"
        val remoteCallbackUrl = "http://localhost:9999/old-callback"
        val desiredCallbackUrl = "http://localhost:9999/new-callback"
        val kanalen = listOf(Abonnement.Kanaal(naam = "zaken"))

        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = abonnementUrl,
            auth = "test"
        )
        val existingAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = remoteCallbackUrl,
            auth = null,
            kanalen = kanalen
        )
        val updatedAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = desiredCallbackUrl,
            auth = "12345",
            kanalen = kanalen
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any()))
            .thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any()))
            .thenReturn(mock())
        whenever(client.updateAbonnement(any(), any(), any(), any<Abonnement>()))
            .thenReturn(updatedAbonnement)
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI(desiredCallbackUrl))
        whenever(notificatiesApiPlugin.authHeader)
            .thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters())
            .thenReturn(kanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client).updateAbonnement(
            authentication = any(),
            baseUrl = any(),
            abonnementId = eq("123"),
            abonnement = any<Abonnement>()
        )
        verify(notificatiesApiAbonnementLinkRepository).save(any())
    }

    @Test
    fun `should skip update when kanalen are same but in different order`() {
        val listenerInstance: NotificatiesApiListener = mock()
        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val abonnementUrl = "http://localhost:9999/nothing/123"
        val callbackUrl = "http://localhost:9999/callback"
        val remoteKanalen = listOf(
            Abonnement.Kanaal(naam = "documenten"),
            Abonnement.Kanaal(naam = "zaken")
        )
        val desiredKanalen = listOf(
            Abonnement.Kanaal(naam = "zaken"),
            Abonnement.Kanaal(naam = "documenten")
        )

        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = abonnementUrl,
            auth = "test"
        )
        val existingAbonnement = Abonnement(
            url = abonnementUrl,
            callbackUrl = callbackUrl,
            auth = null,
            kanalen = remoteKanalen
        )

        whenever(client.getAbonnementen(any(), any()))
            .thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any()))
            .thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any()))
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId)
            .thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl)
            .thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader)
            .thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin())
            .thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters())
            .thenReturn(desiredKanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll())
            .thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client, never()).updateAbonnement(
            authentication = any(),
            baseUrl = any(),
            abonnementId = any(),
            abonnement = any<Abonnement>()
        )
        verify(notificatiesApiAbonnementLinkRepository).save(any())
    }

    @Test
    fun `should not register abonnementen when a plugin configuration changes before application is fully ready`() {
        pluginsDeployedEventListener.handlePluginConfigurationCreatedEvent(
            PluginConfigurationCreatedEvent(mock())
        )

        verifyNoInteractions(client)
        verifyNoInteractions(pluginService)
        verifyNoInteractions(notificatiesApiAbonnementLinkRepository)
    }

    @Test
    fun `should register abonnementen when a Notificaties API plugin configuration is created`() {
        markApplicationFullyReady()

        pluginsDeployedEventListener.handlePluginConfigurationCreatedEvent(
            PluginConfigurationCreatedEvent(notificatiesApiPluginConfiguration())
        )

        // getPluginConfigurations is called by markApplicationFullyReady() and again for the create
        verify(pluginService, times(2)).getPluginConfigurations(any())
    }

    @Test
    fun `should not register abonnementen when an unrelated plugin configuration is changed`() {
        markApplicationFullyReady()

        pluginsDeployedEventListener.handlePluginConfigurationUpdatedEvent(
            PluginConfigurationUpdatedEvent(unrelatedPluginConfiguration())
        )

        // only the markApplicationFullyReady() call, none triggered by the unrelated change
        verify(pluginService, times(1)).getPluginConfigurations(any())
        verifyNoInteractions(client)
    }

    @Test
    fun `should log and skip when abonnement registration is disabled`(output: CapturedOutput) {
        val disabledListener = PluginsDeployedEventListener(
            client = client,
            notificatiesApiAbonnementLinkRepository = notificatiesApiAbonnementLinkRepository,
            pluginService = pluginService,
            registerAbonnementen = false
        )

        disabledListener.registerAbonnementenForNotificatiesApiPlugins()

        assertThat(output).contains("Notificaties API abonnement registration is disabled")
        verifyNoInteractions(client)
        verifyNoInteractions(pluginService)
        verifyNoInteractions(notificatiesApiAbonnementLinkRepository)
    }

    @Test
    fun `should delete remote abonnement and local link when a tracked plugin configuration is deleted`(output: CapturedOutput) {
        markApplicationFullyReady()

        val pluginConfigurationId = UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        val configurationId = NotificatiesApiConfigurationId.existingId(pluginConfigurationId)
        val abonnementLink = NotificatiesApiAbonnementLink(
            notificatiesApiConfigurationId = configurationId,
            url = "http://localhost:9999/nothing/123",
            auth = "test"
        )
        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()
        whenever(notificatiesApiPlugin.url)
            .thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration)
            .thenReturn(mock())

        val deletedConfiguration = notificatiesApiPluginConfiguration(pluginConfigurationId)
        whenever(notificatiesApiAbonnementLinkRepository.findById(configurationId))
            .thenReturn(Optional.of(abonnementLink))
        whenever(pluginService.createInstance(any<PluginConfiguration>()))
            .thenReturn(notificatiesApiPlugin)

        pluginsDeployedEventListener.handlePluginConfigurationDeletedEvent(
            PluginConfigurationDeletedEvent(deletedConfiguration)
        )

        verify(client).deleteAbonnement(any(), any(), eq("123"))
        verify(notificatiesApiAbonnementLinkRepository).delete(abonnementLink)

        assertThat(output).contains("Successfully deleted abonnement with id '123' for removed plugin configuration")
        assertThat(output).contains("123e4567-e89b-12d3-a456-426614174000")
    }

    @Test
    fun `should not delete any abonnement when the deleted configuration is not tracked`() {
        markApplicationFullyReady()

        val deletedConfiguration = notificatiesApiPluginConfiguration()
        whenever(notificatiesApiAbonnementLinkRepository.findById(any()))
            .thenReturn(Optional.empty())

        pluginsDeployedEventListener.handlePluginConfigurationDeletedEvent(
            PluginConfigurationDeletedEvent(deletedConfiguration)
        )

        verify(client, never()).deleteAbonnement(any(), any(), any())
        verify(notificatiesApiAbonnementLinkRepository, never()).delete(any())
    }

    @Test
    fun `should skip remote deletion when abonnement registration is disabled`(output: CapturedOutput) {
        val disabledListener = PluginsDeployedEventListener(
            client = client,
            notificatiesApiAbonnementLinkRepository = notificatiesApiAbonnementLinkRepository,
            pluginService = pluginService,
            registerAbonnementen = false
        )
        disabledListener.handleApplicationFullyReadyEvent()

        disabledListener.handlePluginConfigurationDeletedEvent(
            PluginConfigurationDeletedEvent(notificatiesApiPluginConfiguration())
        )

        assertThat(output).contains("Notificaties API abonnement registration is disabled")
        verifyNoInteractions(client)
    }

    private fun markApplicationFullyReady() {
        whenever(pluginService.getPluginConfigurations(any()))
            .thenReturn(emptyList())
        pluginsDeployedEventListener.handleApplicationFullyReadyEvent()
    }

    private fun notificatiesApiPluginConfiguration(
        id: UUID = UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
    ): PluginConfiguration = pluginConfiguration(id, NotificatiesApiPlugin::class.java.name)

    private fun unrelatedPluginConfiguration(): PluginConfiguration =
        pluginConfiguration(UUID.randomUUID(), String::class.java.name)

    private fun pluginConfiguration(id: UUID, fullyQualifiedClassName: String): PluginConfiguration {
        val pluginDefinition: PluginDefinition = mock()
        whenever(pluginDefinition.fullyQualifiedClassName).thenReturn(fullyQualifiedClassName)
        val configuration: PluginConfiguration = mock()
        whenever(configuration.id).thenReturn(PluginConfigurationId.existingId(id))
        whenever(configuration.pluginDefinition).thenReturn(pluginDefinition)
        return configuration
    }

}
