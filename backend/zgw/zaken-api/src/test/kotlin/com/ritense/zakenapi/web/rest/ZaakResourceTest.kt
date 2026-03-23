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

package com.ritense.zakenapi.web.rest

import com.ritense.zakenapi.exception.MultipleZakenFoundException
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.service.ZaakService
import java.util.UUID
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

internal class ZaakResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var zaakService: ZaakService

    @BeforeEach
    fun setUp() {
        zaakService = mock()
        val zaakResource = ZaakResource(zaakService)
        mockMvc = MockMvcBuilders.standaloneSetup(zaakResource).build()
    }

    @Test
    fun `should return actief true when zaak has no einddatum`() {
        whenever(zaakService.getActiveStatus(eq("ZAAK-001"), isNull())).thenReturn(true)

        mockMvc.perform(
            get("/api/v1/zaken-api/zaak/{zaakIdentificatie}/actief", "ZAAK-001")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.actief").value(true))
    }

    @Test
    fun `should return actief false when zaak has einddatum`() {
        whenever(zaakService.getActiveStatus(eq("ZAAK-001"), isNull())).thenReturn(false)

        mockMvc.perform(
            get("/api/v1/zaken-api/zaak/{zaakIdentificatie}/actief", "ZAAK-001")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.actief").value(false))
    }

    @Test
    fun `should return 404 when no authorized zaak found`() {
        whenever(zaakService.getActiveStatus(eq("ZAAK-001"), isNull()))
            .thenThrow(ZaakNotFoundException("No authorized zaak found for identificatie 'ZAAK-001'"))

        mockMvc.perform(
            get("/api/v1/zaken-api/zaak/{zaakIdentificatie}/actief", "ZAAK-001")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.errorCode").value("ZAAK_NOT_FOUND"))
    }

    @Test
    fun `should return 409 when more than one authorized zaak found`() {
        whenever(zaakService.getActiveStatus(eq("ZAAK-001"), isNull()))
            .thenThrow(MultipleZakenFoundException("More than one authorized zaak found for identificatie 'ZAAK-001'"))

        mockMvc.perform(
            get("/api/v1/zaken-api/zaak/{zaakIdentificatie}/actief", "ZAAK-001")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.errorCode").value("MORE_THAN_ONE_ZAAK_FOUND"))
    }

    @Test
    fun `should pass plugin id when provided`() {
        val pluginId = UUID.randomUUID()
        whenever(zaakService.getActiveStatus(eq("ZAAK-001"), eq(pluginId))).thenReturn(true)

        mockMvc.perform(
            get("/api/v1/zaken-api/zaak/{zaakIdentificatie}/actief", "ZAAK-001")
                .param("zaken_api_plugin_id", pluginId.toString())
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.actief").value(true))
    }

}
