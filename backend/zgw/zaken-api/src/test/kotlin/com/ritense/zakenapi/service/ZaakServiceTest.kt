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

package com.ritense.zakenapi.service

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.exception.MultipleZakenFoundException
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.security.Zaak
import com.ritense.zakenapi.security.ZaakActionProvider
import com.ritense.zgw.Page
import com.ritense.zgw.Rsin
import java.net.URI
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

internal class ZaakServiceTest {

    private lateinit var pluginService: PluginService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var zaakService: ZaakService
    private lateinit var zakenApiPlugin: ZakenApiPlugin

    @BeforeEach
    fun setUp() {
        pluginService = mock()
        authorizationService = mock()
        zakenApiPlugin = mock()
        zaakService = ZaakService(pluginService, authorizationService)
    }

    @Test
    fun `should return true when zaak has no einddatum`() {
        val pluginId = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/123")
        val zaak = createZaakResponse(zaaktype = zaaktype, einddatum = null)

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(1, results = listOf(zaak)))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(true)

        val result = zaakService.getActiveStatus("ZAAK-001", pluginId)

        assertTrue(result)
    }

    @Test
    fun `should return false when zaak has einddatum`() {
        val pluginId = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/123")
        val zaak = createZaakResponse(zaaktype = zaaktype, einddatum = LocalDate.of(2025, 1, 1))

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(1, results = listOf(zaak)))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(true)

        val result = zaakService.getActiveStatus("ZAAK-001", pluginId)

        assertFalse(result)
    }

    @Test
    fun `should filter unauthorized zaken`() {
        val pluginId = UUID.randomUUID()
        val authorizedZaaktype = URI("https://example.com/zaaktypen/authorized")
        val unauthorizedZaaktype = URI("https://example.com/zaaktypen/unauthorized")
        val authorizedZaak = createZaakResponse(zaaktype = authorizedZaaktype, einddatum = null)
        val unauthorizedZaak = createZaakResponse(zaaktype = unauthorizedZaaktype, einddatum = null)

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(
            Page(2, results = listOf(authorizedZaak, unauthorizedZaak))
        )
        whenever(authorizationService.hasPermission(argThat<EntityAuthorizationRequest<Zaak>> {
            entities.any { it.zaaktype == authorizedZaaktype.toString() }
        })).thenReturn(true)
        whenever(authorizationService.hasPermission(argThat<EntityAuthorizationRequest<Zaak>> {
            entities.any { it.zaaktype == unauthorizedZaaktype.toString() }
        })).thenReturn(false)

        val result = zaakService.getActiveStatus("ZAAK-001", pluginId)

        assertTrue(result)
    }

    @Test
    fun `should throw when no authorized zaak found`() {
        val pluginId = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/123")
        val zaak = createZaakResponse(zaaktype = zaaktype)

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(1, results = listOf(zaak)))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(false)

        assertThrows<ZaakNotFoundException> {
            zaakService.getActiveStatus("ZAAK-001", pluginId)
        }
    }

    @Test
    fun `should throw when no zaken found at all`() {
        val pluginId = UUID.randomUUID()

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(0, results = emptyList()))

        assertThrows<ZaakNotFoundException> {
            zaakService.getActiveStatus("ZAAK-001", pluginId)
        }
    }

    @Test
    fun `should throw when more than one authorized zaak found`() {
        val pluginId = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/123")
        val zaak1 = createZaakResponse(zaaktype = zaaktype)
        val zaak2 = createZaakResponse(zaaktype = zaaktype)

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(2, results = listOf(zaak1, zaak2)))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(true)

        assertThrows<MultipleZakenFoundException> {
            zaakService.getActiveStatus("ZAAK-001", pluginId)
        }
    }

    @Test
    fun `should search across all plugin configurations when no plugin id specified`() {
        val configId1 = UUID.randomUUID()
        val configId2 = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/123")
        val zaak = createZaakResponse(zaaktype = zaaktype, einddatum = null)

        val config1 = mock<PluginConfiguration> {
            on { id } doReturn PluginConfigurationId(configId1)
        }
        val config2 = mock<PluginConfiguration> {
            on { id } doReturn PluginConfigurationId(configId2)
        }

        val plugin1 = mock<ZakenApiPlugin>()
        val plugin2 = mock<ZakenApiPlugin>()

        whenever(pluginService.findPluginConfigurations(ZakenApiPlugin::class.java)).thenReturn(listOf(config1, config2))
        whenever(pluginService.createInstance<ZakenApiPlugin>(configId1)).thenReturn(plugin1)
        whenever(pluginService.createInstance<ZakenApiPlugin>(configId2)).thenReturn(plugin2)
        whenever(plugin1.searchZaken(any(), any())).thenReturn(Page(1, results = listOf(zaak)))
        whenever(plugin2.searchZaken(any(), any())).thenReturn(Page(0, results = emptyList()))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(true)

        val result = zaakService.getActiveStatus("ZAAK-001", null)

        assertTrue(result)
        verify(plugin1).searchZaken(any(), any())
        verify(plugin2).searchZaken(any(), any())
    }

    @Test
    fun `should throw when no plugin configurations found`() {
        whenever(pluginService.findPluginConfigurations(ZakenApiPlugin::class.java)).thenReturn(emptyList())

        val exception = assertThrows<IllegalStateException> {
            zaakService.getActiveStatus("ZAAK-001", null)
        }
        assertTrue(exception.message!!.contains("No ZakenApiPlugin configurations found"))
    }

    @Test
    fun `should pass zaaktype to authorization check`() {
        val pluginId = UUID.randomUUID()
        val zaaktype = URI("https://example.com/zaaktypen/specific-type")
        val zaak = createZaakResponse(zaaktype = zaaktype, einddatum = null)

        whenever(pluginService.createInstance<ZakenApiPlugin>(pluginId)).thenReturn(zakenApiPlugin)
        whenever(zakenApiPlugin.searchZaken(any(), any())).thenReturn(Page(1, results = listOf(zaak)))
        whenever(authorizationService.hasPermission(any<EntityAuthorizationRequest<Zaak>>())).thenReturn(true)

        zaakService.getActiveStatus("ZAAK-001", pluginId)

        verify(authorizationService).hasPermission(argThat<EntityAuthorizationRequest<Zaak>> {
            resourceType == Zaak::class.java &&
                action == ZaakActionProvider.VIEW_ACTIVE_STATUS &&
                entities.size == 1 &&
                entities[0].zaaktype == zaaktype.toString()
        })
    }

    private fun createZaakResponse(
        zaaktype: URI = URI("https://example.com/zaaktypen/default"),
        einddatum: LocalDate? = null
    ): ZaakResponse {
        return ZaakResponse(
            url = URI("https://example.com/zaken/${UUID.randomUUID()}"),
            uuid = UUID.randomUUID(),
            bronorganisatie = Rsin("002564440"),
            zaaktype = zaaktype,
            verantwoordelijkeOrganisatie = Rsin("002564440"),
            startdatum = LocalDate.of(2024, 1, 1),
            einddatum = einddatum
        )
    }
}
