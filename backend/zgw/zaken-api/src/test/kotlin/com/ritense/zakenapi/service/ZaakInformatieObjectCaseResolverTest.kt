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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakInstanceLinkId
import com.ritense.zakenapi.repository.ZaakInstanceLinkRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpServerErrorException
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

class ZaakInformatieObjectCaseResolverTest {

    private lateinit var pluginService: PluginService
    private lateinit var zaakInstanceLinkRepository: ZaakInstanceLinkRepository
    private lateinit var resolver: ZaakInformatieObjectCaseResolver

    private val informatieobjectUrl = URI("https://documenten.example.com/enkelvoudiginformatieobjecten/$DOCUMENT_ID")

    @BeforeEach
    fun before() {
        pluginService = mock()
        zaakInstanceLinkRepository = mock()
        resolver = ZaakInformatieObjectCaseResolver(pluginService, zaakInstanceLinkRepository)

        val documentenApiPlugin = mock<DocumentenApiPlugin>()
        whenever(documentenApiPlugin.createInformatieObjectUrl(DOCUMENT_ID)).thenReturn(informatieobjectUrl)
        whenever(pluginService.createInstance<DocumentenApiPlugin>(PLUGIN_CONFIGURATION_ID))
            .thenReturn(documentenApiPlugin)
    }

    @Test
    fun `should return case document ids of zaken the informatieobject is linked to`() {
        val zaakUrl = URI("https://zaken.example.com/zaken/${UUID.randomUUID()}")
        val caseDocumentId = UUID.randomUUID()
        mockZakenApiPlugin(listOf(zaakInformatieObject(zaakUrl)))
        mockZaakInstanceLink(zaakUrl, caseDocumentId)

        val result = resolver.getLinkedCaseDocumentIds(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        assertEquals(listOf(caseDocumentId), result)
    }

    @Test
    fun `should skip zaken without linked case`() {
        mockZakenApiPlugin(listOf(zaakInformatieObject(URI("https://zaken.example.com/zaken/unlinked"))))

        val result = resolver.getLinkedCaseDocumentIds(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should return no cases when informatieobject has no zaakinformatieobjecten`() {
        mockZakenApiPlugin(emptyList())

        val result = resolver.getLinkedCaseDocumentIds(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should return distinct case document ids across zaken api plugin configurations`() {
        val zaakUrl = URI("https://zaken.example.com/zaken/${UUID.randomUUID()}")
        val caseDocumentId = UUID.randomUUID()
        val zaakInformatieObjecten = listOf(zaakInformatieObject(zaakUrl))
        mockZakenApiPlugins(zaakInformatieObjecten, zaakInformatieObjecten)
        mockZaakInstanceLink(zaakUrl, caseDocumentId)

        val result = resolver.getLinkedCaseDocumentIds(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        assertEquals(listOf(caseDocumentId), result)
    }

    @Test
    fun `should continue with other zaken api plugin configurations when a lookup fails`() {
        val zaakUrl = URI("https://zaken.example.com/zaken/${UUID.randomUUID()}")
        val caseDocumentId = UUID.randomUUID()
        val failingPlugin = mock<ZakenApiPlugin>()
        whenever(failingPlugin.getZaakInformatieObjectenByInformatieobjectUrl(null, informatieobjectUrl))
            .doThrow(HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR))
        val workingPlugin = mock<ZakenApiPlugin>()
        whenever(workingPlugin.getZaakInformatieObjectenByInformatieobjectUrl(null, informatieobjectUrl))
            .thenReturn(listOf(zaakInformatieObject(zaakUrl)))
        registerZakenApiPlugins(failingPlugin, workingPlugin)
        mockZaakInstanceLink(zaakUrl, caseDocumentId)

        val result = resolver.getLinkedCaseDocumentIds(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        assertEquals(listOf(caseDocumentId), result)
    }

    private fun mockZakenApiPlugin(zaakInformatieObjecten: List<ZaakInformatieObject>) =
        mockZakenApiPlugins(zaakInformatieObjecten)

    private fun mockZakenApiPlugins(vararg zaakInformatieObjecten: List<ZaakInformatieObject>) {
        val plugins = zaakInformatieObjecten.map { result ->
            val plugin = mock<ZakenApiPlugin>()
            whenever(plugin.getZaakInformatieObjectenByInformatieobjectUrl(null, informatieobjectUrl))
                .thenReturn(result)
            plugin
        }
        registerZakenApiPlugins(*plugins.toTypedArray())
    }

    private fun registerZakenApiPlugins(vararg plugins: ZakenApiPlugin) {
        val configurations = plugins.map { plugin ->
            val configuration = mock<PluginConfiguration>()
            val configurationId = PluginConfigurationId.existingId(UUID.randomUUID())
            whenever(configuration.id).thenReturn(configurationId)
            whenever(pluginService.createInstance(configurationId)).thenReturn(plugin)
            configuration
        }
        whenever(pluginService.findPluginConfigurations(eq(ZakenApiPlugin::class.java), any<(JsonNode) -> Boolean>()))
            .thenReturn(configurations)
    }

    private fun mockZaakInstanceLink(zaakUrl: URI, caseDocumentId: UUID) {
        whenever(zaakInstanceLinkRepository.findByZaakInstanceUrl(zaakUrl)).thenReturn(
            ZaakInstanceLink(
                ZaakInstanceLinkId.newId(UUID.randomUUID()),
                zaakUrl,
                UUID.randomUUID(),
                caseDocumentId,
                URI("https://catalogi.example.com/zaaktypen/${UUID.randomUUID()}")
            )
        )
    }

    private fun zaakInformatieObject(zaakUrl: URI) = ZaakInformatieObject(
        url = URI("https://zaken.example.com/zaakinformatieobjecten/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        informatieobject = informatieobjectUrl,
        zaak = zaakUrl,
        aardRelatieWeergave = "Hoort bij, omgekeerd: kent",
        registratiedatum = LocalDateTime.now(),
    )

    companion object {
        private const val PLUGIN_CONFIGURATION_ID = "c850401b-9331-4cb6-8f1c-3e34b12e3d55"
        private const val DOCUMENT_ID = "3bd88200-11cb-45cf-a742-da01261755b1"
    }
}
