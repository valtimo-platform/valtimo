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

package com.ritense.zakenapi.widget

import com.ritense.catalogiapi.CatalogiApiPlugin
import com.ritense.catalogiapi.domain.Statustype
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.domain.ZaakStatus
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class ZaakMetrolineDataServiceImplTest {

    @Mock
    private lateinit var zaakUrlProvider: ZaakUrlProvider

    @Mock
    private lateinit var pluginService: PluginService

    @Mock
    private lateinit var zakenApiPlugin: ZakenApiPlugin

    @Mock
    private lateinit var catalogiApiPlugin: CatalogiApiPlugin

    @Mock
    private lateinit var zaakResponse: ZaakResponse

    private lateinit var service: ZaakMetrolineDataServiceImpl

    private val documentId = UUID.randomUUID()
    private val zaakUrl = URI("https://zaken.example.com/api/v1/zaken/123")
    private val zaaktypeUrl = URI("https://catalogi.example.com/api/v1/zaaktypen/456")

    @BeforeEach
    fun setUp() {
        service = ZaakMetrolineDataServiceImpl(zaakUrlProvider, pluginService)
    }

    @Test
    fun `should return all statustypen sorted by volgnummer with completed timestamp`() {
        setupPlugins()

        val statustypeUrl1 = URI("https://catalogi.example.com/api/v1/statustypen/1")
        val statustypeUrl2 = URI("https://catalogi.example.com/api/v1/statustypen/2")
        val statustypeUrl3 = URI("https://catalogi.example.com/api/v1/statustypen/3")
        val datumGezet1 = LocalDateTime.of(2026, 1, 1, 10, 0)

        whenever(catalogiApiPlugin.getStatustypen(zaaktypeUrl)).thenReturn(listOf(
            statustype(statustypeUrl3, "Afgehandeld", "Zaak afgerond", 3),
            statustype(statustypeUrl1, "Zaak gestart", "Aanvraag ontvangen", 1),
            statustype(statustypeUrl2, "In behandeling", null, 2),
        ))

        whenever(zakenApiPlugin.getZaakStatussen(zaakUrl)).thenReturn(listOf(
            zaakStatus(statustypeUrl1, datumGezet1),
        ))

        val result = service.getMetrolineItems(documentId)

        assertThat(result).hasSize(3)
        assertThat(result[0].title).isEqualTo("Zaak gestart")
        assertThat(result[0].label).isEqualTo("Aanvraag ontvangen")
        assertThat(result[0].completed).isEqualTo(datumGezet1)
        assertThat(result[1].title).isEqualTo("In behandeling")
        assertThat(result[1].label).isNull()
        assertThat(result[1].completed).isNull()
        assertThat(result[2].title).isEqualTo("Afgehandeld")
        assertThat(result[2].label).isEqualTo("Zaak afgerond")
        assertThat(result[2].completed).isNull()
    }

    @Test
    fun `should mark multiple statuses as completed with timestamps`() {
        setupPlugins()

        val statustypeUrl1 = URI("https://catalogi.example.com/api/v1/statustypen/1")
        val statustypeUrl2 = URI("https://catalogi.example.com/api/v1/statustypen/2")
        val datumGezet1 = LocalDateTime.of(2026, 1, 1, 10, 0)
        val datumGezet2 = LocalDateTime.of(2026, 1, 2, 14, 30)

        whenever(catalogiApiPlugin.getStatustypen(zaaktypeUrl)).thenReturn(listOf(
            statustype(statustypeUrl1, "Zaak gestart", null, 1),
            statustype(statustypeUrl2, "In behandeling", null, 2),
        ))

        whenever(zakenApiPlugin.getZaakStatussen(zaakUrl)).thenReturn(listOf(
            zaakStatus(statustypeUrl1, datumGezet1),
            zaakStatus(statustypeUrl2, datumGezet2),
        ))

        val result = service.getMetrolineItems(documentId)

        assertThat(result).hasSize(2)
        assertThat(result[0].completed).isEqualTo(datumGezet1)
        assertThat(result[1].completed).isEqualTo(datumGezet2)
    }

    @Test
    fun `should return empty list when no statustypen configured`() {
        setupPlugins()

        whenever(catalogiApiPlugin.getStatustypen(zaaktypeUrl)).thenReturn(emptyList())
        whenever(zakenApiPlugin.getZaakStatussen(zaakUrl)).thenReturn(emptyList())

        val result = service.getMetrolineItems(documentId)

        assertThat(result).isEmpty()
    }

    private fun setupPlugins() {
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zakenApiPlugin)
        whenever(pluginService.createInstance(eq(CatalogiApiPlugin::class.java), any()))
            .thenReturn(catalogiApiPlugin)
        whenever(zakenApiPlugin.getZaak(zaakUrl)).thenReturn(zaakResponse)
        whenever(zaakResponse.zaaktype).thenReturn(zaaktypeUrl)
    }

    private fun statustype(url: URI, omschrijving: String, toelichting: String?, volgnummer: Int) =
        Statustype(
            url = url,
            zaaktype = zaaktypeUrl,
            omschrijving = omschrijving,
            omschrijvingGeneriek = null,
            statustekst = null,
            volgnummer = volgnummer,
            toelichting = toelichting,
            isEindstatus = false,
            informeren = false,
        )

    private fun zaakStatus(statustypeUrl: URI, datumStatusGezet: LocalDateTime = LocalDateTime.now()) =
        ZaakStatus(
            url = URI("https://zaken.example.com/api/v1/statussen/${UUID.randomUUID()}"),
            uuid = UUID.randomUUID(),
            zaak = zaakUrl,
            statustype = statustypeUrl,
            datumStatusGezet = datumStatusGezet,
        )
}
