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

package com.ritense.zakenapi.formflow

import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.exception.MultipleZakenFoundException
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.service.ZaakService
import com.ritense.zgw.Rsin
import java.net.URI
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

internal class ZakenFormFlowTest {

    private lateinit var zaakService: ZaakService
    private lateinit var zakenFormFlow: ZakenFormFlow

    @BeforeEach
    fun setUp() {
        zaakService = mock()
        zakenFormFlow = ZakenFormFlow(zaakService)
    }

    @Test
    fun `should return zaak when found`() {
        val zaak = createZaakResponse()
        whenever(zaakService.getZaakByIdentificatie(eq("ZAAK-001"), isNull())).thenReturn(zaak)

        val result = zakenFormFlow.getZaak("ZAAK-001", null)

        assertEquals(zaak, result)
    }

    @Test
    fun `should return null when no authorized zaak found`() {
        whenever(zaakService.getZaakByIdentificatie(eq("ZAAK-001"), isNull()))
            .thenThrow(ZaakNotFoundException("No authorized zaak found for identificatie 'ZAAK-001'"))

        val result = zakenFormFlow.getZaak("ZAAK-001", null)

        assertNull(result)
    }

    @Test
    fun `should pass plugin id when provided`() {
        val pluginId = UUID.randomUUID()
        val zaak = createZaakResponse()
        whenever(zaakService.getZaakByIdentificatie(eq("ZAAK-001"), eq(pluginId))).thenReturn(zaak)

        val result = zakenFormFlow.getZaak("ZAAK-001", pluginId)

        assertEquals(zaak, result)
    }

    @Test
    fun `should propagate exception when more than one authorized zaak found`() {
        whenever(zaakService.getZaakByIdentificatie(eq("ZAAK-001"), isNull()))
            .thenThrow(MultipleZakenFoundException("More than one authorized zaak found for identificatie 'ZAAK-001'"))

        assertThrows<MultipleZakenFoundException> {
            zakenFormFlow.getZaak("ZAAK-001", null)
        }
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
