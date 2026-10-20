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

package com.ritense.zakenapi.resolver

import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.web.client.HttpClientErrorException
import org.springframework.http.HttpStatus
import com.ritense.zgw.Rsin
import java.net.URI
import java.time.LocalDate
import java.util.UUID

class ZaakValueResolverFactoryTest {

    private val zaakUrlProvider: ZaakUrlProvider = mock()
    private val pluginService: PluginService = mock()
    private val plugin: ZakenApiPlugin = mock()
    private val factory = ZaakValueResolverFactory(mock<ProcessDocumentService>(), zaakUrlProvider, pluginService)

    private val documentId = UUID.randomUUID()
    private val zaakUrl = URI("http://example.com/zaken/api/v1/zaken/${UUID.randomUUID()}")

    @Test
    fun `should resolve field from zaak fetched through plugin`() {
        val zaak = ZaakResponse(
            url = zaakUrl,
            uuid = UUID.randomUUID(),
            identificatie = "ZAAK-1",
            bronorganisatie = Rsin("051845623"),
            zaaktype = URI("http://example.com/zaaktype"),
            verantwoordelijkeOrganisatie = Rsin("051845623"),
            startdatum = LocalDate.now()
        )
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(pluginService.createInstance(any<Class<ZakenApiPlugin>>(), any())).thenReturn(plugin)
        whenever(plugin.getZaak(zaakUrl)).thenReturn(zaak)

        val resolver = factory.createResolver(documentId.toString())

        assertEquals("ZAAK-1", resolver.apply("identificatie"))
    }

    @Test
    fun `should throw when plugin configuration is missing`() {
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(pluginService.createInstance(any<Class<ZakenApiPlugin>>(), any())).thenReturn(null)

        assertThrows<IllegalStateException> { factory.createResolver(documentId.toString()) }
    }

    @Test
    fun `should propagate failure of getZaak`() {
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(pluginService.createInstance(any<Class<ZakenApiPlugin>>(), any())).thenReturn(plugin)
        whenever(plugin.getZaak(zaakUrl)).thenThrow(HttpClientErrorException(HttpStatus.FORBIDDEN))

        assertThrows<HttpClientErrorException> { factory.createResolver(documentId.toString()) }
    }
}
