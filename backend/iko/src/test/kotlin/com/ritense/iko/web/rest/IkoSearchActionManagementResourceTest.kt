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

package com.ritense.iko.web.rest

import com.ritense.iko.IkoServerRepository.Companion.ENDPOINT_QUERY_PARAMETERS
import com.ritense.iko.domain.IkoView
import com.ritense.iko.domain.IkoSeachAction
import com.ritense.iko.domain.IkoSeachActionId
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.service.IkoSeachActionService
import com.ritense.iko.web.rest.request.IkoSeachActionCreateRequest
import com.ritense.iko.web.rest.request.IkoSeachActionUpdateRequest
import com.ritense.valtimo.contract.iko.PropertyField
import com.ritense.valtimo.contract.iko.PropertyField.Companion.PROPERTY_FIELD_TYPE_TEXT
import com.ritense.valtimo.contract.json.MapperSingleton
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.http.MediaType.APPLICATION_JSON_VALUE
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional

@Transactional
internal class IkoSeachActionManagementResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var resource: IkoSeachActionManagementResource
    private lateinit var service: IkoSeachActionService
    private lateinit var ikoViewService: IkoViewService

    private val objectMapper = MapperSingleton.get()

    @BeforeEach
    fun init() {
        service = mock()
        ikoViewService = mock()
        resource = IkoSeachActionManagementResource(service, ikoViewService)
        mockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(MapperSingleton.get()))
            .build();
    }

    @Test
    fun `should get iko ikoSeachAction property fields`() {
        whenever(service.getIkoSeachActionPropertyFields("iko")).thenReturn(
            listOf(
                PropertyField(
                    key = ENDPOINT_QUERY_PARAMETERS,
                    type = PROPERTY_FIELD_TYPE_TEXT
                )
            )
        )

        mockMvc.perform(get("/api/management/v1/iko-property-fields/{type}/iko-search-action", "iko"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.*", hasSize<Int>(1)))
            .andExpect(jsonPath("$[0].title").value("Endpoint Query Parameters"))
            .andExpect(jsonPath("$[0].key").value("endpointQueryParameters"))
            .andExpect(jsonPath("$[0].type").value("text"))
    }

    @Test
    fun `should get iko ikoSeachActions`() {
        whenever(service.findAll(isNull(), eq("klant"), isNull())).thenReturn(
            listOf(
                IkoSeachAction(
                    id = IkoSeachActionId("bsn", IkoView("klant", "Klant", emptyMap(), mock())),
                    title = "BSN",
                    order = 0,
                    properties = mapOf("endpointQueryParameters" to mapOf("type" to "RaadpleegMetBurgerservicenummer")),
                )
            ),
        )

        mockMvc.perform(get("/api/management/v1/iko-view/{ikoViewKey}/iko-search-action", "klant"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].key").value("bsn"))
            .andExpect(jsonPath("$[0].title").value("BSN"))
    }

    @Test
    fun `should get iko ikoSeachAction by key`() {
        whenever(service.getByKey("bsn", "klant")).thenReturn(
            IkoSeachAction(
                id = IkoSeachActionId("bsn", IkoView("klant", "Klant", emptyMap(), mock())),
                title = "BSN",
                order = 0,
                properties = mapOf("endpointQueryParameters" to mapOf("type" to "RaadpleegMetBurgerservicenummer"))
            )
        )

        mockMvc.perform(
            get(
                "/api/management/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}",
                "klant",
                "bsn"
            )
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("bsn"))
            .andExpect(jsonPath("$.title").value("BSN"))
            .andExpect(jsonPath("$.properties.endpointQueryParameters.type").value("RaadpleegMetBurgerservicenummer"))
    }

    @Test
    fun `should create iko ikoSeachAction`() {
        val ikoView = IkoView("klant", "Klant", emptyMap(), mock())
        val ikoSeachAction = IkoSeachAction(
            id = IkoSeachActionId("bsn", ikoView),
            title = "BSN",
            order = 0,
            properties = mapOf("endpointQueryParameters" to mapOf("type" to "RaadpleegMetBurgerservicenummer")),
        )
        val request = IkoSeachActionCreateRequest(
            ikoSeachAction.title,
            ikoSeachAction.properties
        )
        whenever(ikoViewService.getByKey("klant")).thenReturn(ikoView)
        whenever(service.create(any())).thenReturn(ikoSeachAction)

        mockMvc.perform(
            post(
                "/api/management/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}",
                "klant",
                "bsn"
            )
                .content(objectMapper.writeValueAsString(request))
                .contentType(APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("bsn"))
            .andExpect(jsonPath("$.title").value("BSN"))
            .andExpect(jsonPath("$.properties.endpointQueryParameters.type").value("RaadpleegMetBurgerservicenummer"))
    }

    @Test
    fun `should update iko ikoSeachAction`() {
        val ikoSeachAction = IkoSeachAction(
            id = IkoSeachActionId("bsn", IkoView("klant", "Klant", emptyMap(), mock())),
            title = "BSN",
            order = 0,
            properties = mapOf("endpointQueryParameters" to mapOf("type" to "RaadpleegMetBurgerservicenummer")),
        )
        val request = IkoSeachActionUpdateRequest(
            ikoSeachAction.id.key,
            ikoSeachAction.id.ikoView.key,
            ikoSeachAction.title,
            ikoSeachAction.properties
        )
        whenever(service.getByKey("bsn", "klant")).thenReturn(ikoSeachAction)
        whenever(service.update(any())).thenReturn(ikoSeachAction)
        mockMvc.perform(
            put(
                "/api/management/v1/iko-view/{ikoViewKey}/iko-search-action/{key}",
                "klant",
                "bsn",
            )
                .content(objectMapper.writeValueAsString(request))
                .contentType(APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("bsn"))
            .andExpect(jsonPath("$.ikoViewKey").value("klant"))
            .andExpect(jsonPath("$.title").value("BSN"))
            .andExpect(jsonPath("$.properties.endpointQueryParameters.type").value("RaadpleegMetBurgerservicenummer"))
    }

    @Test
    fun `should update iko ikoSeachActions`() {
        val ikoSeachAction = IkoSeachAction(
            id = IkoSeachActionId("bsn", IkoView("klant", "Klant", emptyMap(), mock())),
            title = "BSN",
            order = 0,
            properties = mapOf("endpointQueryParameters" to mapOf("type" to "RaadpleegMetBurgerservicenummer")),
        )
        val request = listOf(
            IkoSeachActionUpdateRequest(
                ikoSeachAction.id.key,
                ikoSeachAction.id.ikoView.key,
                ikoSeachAction.title,
                ikoSeachAction.properties
            )
        )
        whenever(service.findAll(ikoViewKey = "klant")).thenReturn(listOf(ikoSeachAction))
        whenever(service.update(any())).thenReturn(ikoSeachAction)
        mockMvc.perform(
            put(
                "/api/management/v1/iko-view/{ikoViewKey}/iko-search-action",
                "klant"
            )
                .content(objectMapper.writeValueAsString(request))
                .contentType(APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].key").value("bsn"))
            .andExpect(jsonPath("$[0].ikoViewKey").value("klant"))
            .andExpect(jsonPath("$[0].title").value("BSN"))
            .andExpect(jsonPath("$[0].properties.endpointQueryParameters.type").value("RaadpleegMetBurgerservicenummer"))
    }

    @Test
    fun `should delete iko ikoSeachAction`() {
        mockMvc.perform(
            delete(
                "/api/management/v1/iko-view/{ikoViewKey}/iko-search-action/{ikoSeachActionKey}",
                "klant",
                "bsn"
            )
        )
            .andDo(print())
            .andExpect(status().isNoContent())
    }

}
