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

package com.ritense.notificatiesapi

import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.events.PluginConfigurationCreatedEvent
import com.ritense.plugin.events.PluginConfigurationDeletedEvent
import com.ritense.plugin.events.PluginConfigurationUpdatedEvent
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.core.task.TaskExecutor
import org.springframework.transaction.support.TransactionTemplate
import java.net.URI
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Covers what [PluginsDeployedEventListenerTest] structurally cannot: the listener runs from a real
 * `@TransactionalEventListener(AFTER_COMMIT)`, against a real transaction manager and a real
 * repository. A `REQUIRED` write in that phase joins an already-committed transaction and is
 * discarded without error, so only an integration test proves the link is actually persisted.
 */
class PluginsDeployedEventListenerIT : BaseIntegrationTest() {

    @MockBean
    lateinit var client: NotificatiesApiClient

    @MockBean
    lateinit var pluginService: PluginService

    // Swallows the startup registration task, so only the events published by a test trigger a run.
    @MockBean(name = "notificatiesApiAbonnementRegistrationExecutor")
    lateinit var registrationExecutor: TaskExecutor

    @Autowired
    lateinit var listener: PluginsDeployedEventListener

    @Autowired
    lateinit var abonnementLinkRepository: NotificatiesApiAbonnementLinkRepository

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    private lateinit var configurationId: UUID

    @BeforeEach
    fun setUp() {
        configurationId = UUID.randomUUID()
        listener.handleApplicationFullyReadyEvent()
        transactionTemplate.executeWithoutResult { abonnementLinkRepository.deleteAll() }

        whenever(client.getAbonnementen(any(), any())).thenReturn(emptyList())
        whenever(client.getKanalen(any(), any())).thenReturn(emptyList())
        whenever(client.createAbonnement(any(), any(), any())).thenAnswer { invocation ->
            val requested = invocation.getArgument<Abonnement>(2)
            requested.copy(url = "$NOTIFICATIES_API_URL/abonnement/$configurationId")
        }
    }

    @Test
    fun `should commit the abonnement link when a plugin configuration is created`() {
        stubNotificatiesApiPluginConfiguration()

        publishInTransaction(PluginConfigurationCreatedEvent(pluginConfiguration(configurationId)))

        val created = argumentCaptor<Abonnement>()
        verify(client).createAbonnement(any(), any(), created.capture())

        val link = findLink()
        assertNotNull(link, "abonnement link was not committed")
        assertEquals(created.firstValue.auth, link.auth)
        assertEquals("$NOTIFICATIES_API_URL/abonnement/$configurationId", link.url)
    }

    @Test
    fun `should reuse the stored auth key on a later plugin configuration update`() {
        stubNotificatiesApiPluginConfiguration()

        publishInTransaction(PluginConfigurationCreatedEvent(pluginConfiguration(configurationId)))
        val authAfterCreate = findLink()!!.auth

        publishInTransaction(PluginConfigurationUpdatedEvent(pluginConfiguration(configurationId)))

        assertEquals(authAfterCreate, findLink()!!.auth)
    }

    @Test
    fun `should commit the removal of the abonnement link when a plugin configuration is deleted`() {
        transactionTemplate.executeWithoutResult {
            abonnementLinkRepository.save(
                NotificatiesApiAbonnementLink(
                    notificatiesApiConfigurationId = NotificatiesApiConfigurationId.existingId(configurationId),
                    url = "$NOTIFICATIES_API_URL/abonnement/$configurationId",
                    auth = "existing-key"
                )
            )
        }
        val plugin = notificatiesApiPlugin()
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(emptyList())
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(plugin)

        publishInTransaction(PluginConfigurationDeletedEvent(pluginConfiguration(configurationId)))

        verify(client).deleteAbonnement(any(), any(), eq(configurationId.toString()))
        assertNull(findLink(), "abonnement link survived plugin configuration deletion")
    }

    private fun publishInTransaction(event: Any) {
        transactionTemplate.executeWithoutResult { applicationEventPublisher.publishEvent(event) }
    }

    private fun findLink(): NotificatiesApiAbonnementLink? =
        abonnementLinkRepository.findById(NotificatiesApiConfigurationId.existingId(configurationId)).orElse(null)

    // Every mock is created before any stubbing starts; creating one inside thenReturn() would
    // interleave with the stubbing in progress and trip Mockito's UnfinishedStubbingException.
    private fun stubNotificatiesApiPluginConfiguration() {
        val plugin = notificatiesApiPlugin()
        val listenerInstance: NotificatiesApiListener = mock()
        val configurations = listOf<PluginConfiguration>(mock())

        whenever(listenerInstance.getNotificatiesApiPlugin()).thenReturn(plugin)
        whenever(listenerInstance.getKanaalFilters()).thenReturn(emptyList())
        whenever(pluginService.getPluginConfigurations(any())).thenReturn(configurations)
        whenever(pluginService.createInstance(any<PluginConfiguration>())).thenReturn(listenerInstance)
    }

    private fun notificatiesApiPlugin(): NotificatiesApiPlugin {
        val plugin: NotificatiesApiPlugin = mock()
        val authentication: NotificatiesApiAuthentication = mock()

        whenever(plugin.url).thenReturn(URI(NOTIFICATIES_API_URL))
        whenever(plugin.callbackUrl).thenReturn(URI(CALLBACK_URL))
        whenever(plugin.authHeader).thenReturn(null)
        whenever(plugin.authenticationPluginConfiguration).thenReturn(authentication)
        whenever(plugin.notificatiesApiConfigurationId)
            .thenReturn(NotificatiesApiConfigurationId.existingId(configurationId))
        return plugin
    }

    private fun pluginConfiguration(id: UUID): PluginConfiguration {
        val pluginDefinition: PluginDefinition = mock()
        val configuration: PluginConfiguration = mock()

        whenever(pluginDefinition.fullyQualifiedClassName).thenReturn(NotificatiesApiPlugin::class.java.name)
        whenever(configuration.id).thenReturn(PluginConfigurationId.existingId(id))
        whenever(configuration.pluginDefinition).thenReturn(pluginDefinition)
        return configuration
    }

    private companion object {
        const val NOTIFICATIES_API_URL = "http://localhost:9999/notificaties"
        const val CALLBACK_URL = "http://localhost:8080/api/v1/notificatiesapi/callback"
    }
}
