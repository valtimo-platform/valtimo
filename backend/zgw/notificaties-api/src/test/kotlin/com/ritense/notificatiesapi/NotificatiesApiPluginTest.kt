/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import com.ritense.notificatiesapi.domain.AbonnementRegistration
import com.ritense.notificatiesapi.domain.Kanaal
import com.ritense.notificatiesapi.domain.NotificatiesApiConfigurationId
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.valtimo.contract.json.MapperSingleton
import jakarta.validation.ValidationException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID

internal class NotificatiesApiPluginTest {
    lateinit var notificatiesApiClient: NotificatiesApiClient
    lateinit var abonnementLinkRepository: NotificatiesApiAbonnementLinkRepository
    lateinit var plugin: NotificatiesApiPlugin
    lateinit var pluginConfigurationId: PluginConfigurationId
    lateinit var notificatiesApiConfigurationId: NotificatiesApiConfigurationId

    @BeforeEach
    fun setup() {
        notificatiesApiClient = mock()
        abonnementLinkRepository = mock()
        pluginConfigurationId = PluginConfigurationId(UUID.randomUUID())
        notificatiesApiConfigurationId = NotificatiesApiConfigurationId(pluginConfigurationId.id)

        plugin = NotificatiesApiPlugin(pluginConfigurationId, notificatiesApiClient, MapperSingleton.get(), mock<PluginProcessLinkRepository>())
            .apply {
                url = URI("http://example.com")
                callbackUrl = URI("http://example.com/callback")
                authenticationPluginConfiguration = mock()
            }
    }


    @Test
    fun `ensure kanaal exists creates kanaal when kanaal doesnt exist`() {

        whenever(notificatiesApiClient.getKanalen(any(), any()))
            .thenReturn(
                listOf(
                    Kanaal(naam = "objecten")
                )
            )

        plugin.ensureKanalenExist(setOf("objecten", "taken", "test-kanaal"))

        verify(notificatiesApiClient, times(1)).getKanalen(any(), any())
        verify(notificatiesApiClient, times(2)).createKanaal(any(), any(), any())
    }

    @Test
    fun `ensure kanaal exists doesnt create kanaal when kanaal exists`() {

        whenever(notificatiesApiClient.getKanalen(any(), any()))
            .thenReturn(
                listOf(
                    Kanaal(naam = "objecten"),
                    Kanaal(naam = "test-kanaal"),
                    Kanaal(naam = "taken")
                )
            )

        plugin.ensureKanalenExist(setOf("objecten", "taken", "test-kanaal"))

        verify(notificatiesApiClient, times(1)).getKanalen(any(), any())
        verify(notificatiesApiClient, never()).createKanaal(any(), any(), any())
    }

    @Test
    fun `should register the abonnement automatically when the registration is not configured`() {
        assertThat(plugin.abonnementRegistration).isEqualTo(AbonnementRegistration.AUTOMATIC)
        assertThat(plugin.isManualAbonnementRegistration()).isFalse()
    }

    @Test
    fun `should read abonnement registration from its configuration value`() {
        val mapper = MapperSingleton.get()

        assertThat(mapper.readValue("\"manual\"", AbonnementRegistration::class.java))
            .isEqualTo(AbonnementRegistration.MANUAL)
        assertThat(mapper.readValue("\"automatic\"", AbonnementRegistration::class.java))
            .isEqualTo(AbonnementRegistration.AUTOMATIC)
        assertThat(mapper.writeValueAsString(AbonnementRegistration.MANUAL)).isEqualTo("\"manual\"")
    }

    @Test
    fun `should refuse a manual registration without a shared secret`() {
        plugin.abonnementRegistration = AbonnementRegistration.MANUAL
        plugin.authHeader = " "

        assertThrows<ValidationException> { plugin.validateAbonnementRegistration() }
    }

    @Test
    fun `should accept a manual registration with a shared secret`() {
        plugin.abonnementRegistration = AbonnementRegistration.MANUAL
        plugin.authHeader = "shared-secret"

        assertDoesNotThrow { plugin.validateAbonnementRegistration() }
    }

    @Test
    fun `should refuse an automatic registration without a callback URL`() {
        val withoutCallbackUrl = NotificatiesApiPlugin(
            pluginConfigurationId, notificatiesApiClient, MapperSingleton.get(), mock<PluginProcessLinkRepository>()
        )

        assertThat(withoutCallbackUrl.callbackUrlOrNull()).isNull()
        assertThrows<ValidationException> { withoutCallbackUrl.validateAbonnementRegistration() }
    }

    @Test
    fun `should accept a manual registration without a callback URL`() {
        val withoutCallbackUrl = NotificatiesApiPlugin(
            pluginConfigurationId, notificatiesApiClient, MapperSingleton.get(), mock<PluginProcessLinkRepository>()
        ).apply {
            abonnementRegistration = AbonnementRegistration.MANUAL
            authHeader = "shared-secret"
        }

        assertDoesNotThrow { withoutCallbackUrl.validateAbonnementRegistration() }
    }

    @Test
    fun `should not create kanalen for a manually registered configuration`() {
        plugin.abonnementRegistration = AbonnementRegistration.MANUAL

        plugin.ensureKanalenExist(setOf("objecten"))

        verify(notificatiesApiClient, never()).getKanalen(any(), any())
        verify(notificatiesApiClient, never()).createKanaal(any(), any(), any())
    }

    @Test
    fun `should accept an automatic registration without a shared secret`() {
        assertDoesNotThrow { plugin.validateAbonnementRegistration() }
    }
}
