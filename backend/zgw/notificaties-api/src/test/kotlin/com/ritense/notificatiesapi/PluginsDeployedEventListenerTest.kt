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
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.mock
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID

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
            client,
            notificatiesApiAbonnementLinkRepository,
            pluginService,
            true
        )
    }

    @Test
    fun `should register nothing`() {
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(
            emptyList()
        )

        assertDoesNotThrow { pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins() }
    }

    @Test
    fun `should shutdown due to inability to connect to abonnementen api`() {
        val pluginInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        whenever(client.getAbonnementen(any(), any()))
            .thenAnswer { _ -> Exception() }
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
    }


    @Test
    fun `should delete old abonnement that API does not have`() {
        val listenerInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            configurationId,
            "http://localhost:9999/nothing/123",
            "test"
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
                "http://localhost:9999/nothing/456",
                "http://localhost:9999/callback",
                "test",
                emptyList()
            ))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(notificatiesApiAbonnementLinkRepository).delete(any())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
        verify(client).createAbonnement(any(), any(), any<Abonnement>())
    }

    @Test
    fun `should delete old abonnement that API does not have with a random header secret`() {
        val listenerInstance: NotificatiesApiListener = mock()

        val notificatiesApiPlugin: NotificatiesApiPlugin = mock()

        val configurationId = NotificatiesApiConfigurationId.existingId(
            UUID.fromString("123e4567-e89b-12d3-a456-426614174000")
        )
        val existingAbonnementLink = NotificatiesApiAbonnementLink(
            configurationId,
            "http://localhost:9999/nothing/123",
            "test"
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
                "http://localhost:9999/nothing/456",
                "http://localhost:9999/callback",
                "test",
                emptyList()
            ))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(notificatiesApiAbonnementLinkRepository).delete(any())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
        verify(client).createAbonnement(any(), any(), any<Abonnement>())
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
            configurationId, abonnementUrl, "test"
        )
        val existingAbonnement = Abonnement(abonnementUrl, callbackUrl, null, kanalen)

        whenever(client.getAbonnementen(any(), any())).thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any())).thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any())).thenReturn(mock())
        whenever(notificatiesApiPlugin.url).thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId).thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration).thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl).thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader).thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin()).thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters()).thenReturn(kanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll()).thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client, never()).updateAbonnement(any(), any(), any(), any<Abonnement>())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
    }

    @Test
    fun `should update abonnement when kanalen have changed`() {
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
            configurationId, abonnementUrl, "test"
        )
        val existingAbonnement = Abonnement(abonnementUrl, callbackUrl, null, remoteKanalen)
        val updatedAbonnement = Abonnement(abonnementUrl, callbackUrl, "12345", desiredKanalen)

        whenever(client.getAbonnementen(any(), any())).thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any())).thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any())).thenReturn(mock())
        whenever(client.updateAbonnement(any(), any(), any(), any<Abonnement>())).thenReturn(updatedAbonnement)
        whenever(notificatiesApiPlugin.url).thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId).thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration).thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl).thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader).thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin()).thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters()).thenReturn(desiredKanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll()).thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client).updateAbonnement(any(), any(), eq("123"), any<Abonnement>())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
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
            configurationId, abonnementUrl, "test"
        )
        val existingAbonnement = Abonnement(abonnementUrl, remoteCallbackUrl, null, kanalen)
        val updatedAbonnement = Abonnement(abonnementUrl, desiredCallbackUrl, "12345", kanalen)

        whenever(client.getAbonnementen(any(), any())).thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any())).thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any())).thenReturn(mock())
        whenever(client.updateAbonnement(any(), any(), any(), any<Abonnement>())).thenReturn(updatedAbonnement)
        whenever(notificatiesApiPlugin.url).thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId).thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration).thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl).thenReturn(URI(desiredCallbackUrl))
        whenever(notificatiesApiPlugin.authHeader).thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin()).thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters()).thenReturn(kanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll()).thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client).updateAbonnement(any(), any(), eq("123"), any<Abonnement>())
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
            configurationId, abonnementUrl, "test"
        )
        val existingAbonnement = Abonnement(abonnementUrl, callbackUrl, null, remoteKanalen)

        whenever(client.getAbonnementen(any(), any())).thenReturn(listOf(existingAbonnement))
        whenever(client.getKanalen(any(), any())).thenReturn(emptyList())
        whenever(client.createKanaal(any(), any(), any())).thenReturn(mock())
        whenever(notificatiesApiPlugin.url).thenReturn(URI("http://localhost:9999/nothing"))
        whenever(notificatiesApiPlugin.notificatiesApiConfigurationId).thenReturn(configurationId)
        whenever(notificatiesApiPlugin.authenticationPluginConfiguration).thenReturn(mock())
        whenever(notificatiesApiPlugin.callbackUrl).thenReturn(URI(callbackUrl))
        whenever(notificatiesApiPlugin.authHeader).thenReturn("12345")
        whenever(listenerInstance.getNotificatiesApiPlugin()).thenReturn(notificatiesApiPlugin)
        whenever(listenerInstance.getKanaalFilters()).thenReturn(desiredKanalen)
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(listenerInstance)
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(listOf(mock()))
        whenever(notificatiesApiAbonnementLinkRepository.findAll()).thenReturn(listOf(existingAbonnementLink))

        pluginsDeployedEventListener.registerAbonnementenForNotificatiesApiPlugins()

        verify(client, never()).updateAbonnement(any(), any(), any(), any<Abonnement>())
        verify(notificatiesApiAbonnementLinkRepository).save(any())
    }

    @Test
    fun `should not register abonnementen when PluginsDeployedEvent fires before application is fully ready`() {
        pluginsDeployedEventListener.handlePluginConfigurationChangedEvent()

        verifyNoInteractions(client)
        verifyNoInteractions(pluginService)
        verifyNoInteractions(notificatiesApiAbonnementLinkRepository)
    }

}
