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

import com.ritense.exporter.ExportService
import com.ritense.iko.IkoServerRepository.Companion.CONNECTOR_INSTANCE_TAG
import com.ritense.iko.IkoServerRepository.Companion.CONNECTOR_TAG
import com.ritense.iko.IkoServerRepository.Companion.ENDPOINT_OPERATION
import com.ritense.iko.domain.IkoView
import com.ritense.iko.domain.IkoRepositoryConfig
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.web.rest.request.IkoViewCreateRequest
import com.ritense.iko.web.rest.request.IkoViewUpdateRequest
import com.ritense.importer.ImportService
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
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
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
internal class IkoViewManagementResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var resource: IkoViewManagementResource
    private lateinit var service: IkoViewService
    private lateinit var exportService: ExportService
    private lateinit var importService: ImportService

    private val objectMapper = MapperSingleton.get()

    @BeforeEach
    fun init() {
        service = mock()
        exportService = mock()
        importService = mock()
        resource = IkoViewManagementResource(service, exportService, importService)
        mockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(MapperSingleton.get()))
            .build();
    }

    @Test
    fun `should get iko ikoView property fields`() {
        whenever(service.getIkoViewPropertyFields("iko")).thenReturn(
            listOf(
                PropertyField(
                    key = CONNECTOR_TAG,
                    title = "Connector Reference",
                    type = PROPERTY_FIELD_TYPE_TEXT
                ),
                PropertyField(
                    key = CONNECTOR_INSTANCE_TAG,
                    title = "Connector Instance Reference",
                    type = PROPERTY_FIELD_TYPE_TEXT
                ),
                PropertyField(
                    key = ENDPOINT_OPERATION,
                    title = "Endpoint Reference",
                    type = PROPERTY_FIELD_TYPE_TEXT
                ),
            )
        )

        mockMvc.perform(get("/api/management/v1/iko-property-fields/{type}/iko-view", "iko"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.*", hasSize<Int>(3)))
            .andExpect(jsonPath("$[0].title").value("Connector Reference"))
            .andExpect(jsonPath("$[0].key").value("connectorTag"))
            .andExpect(jsonPath("$[0].type").value("text"))
            .andExpect(jsonPath("$[1].title").value("Connector Instance Reference"))
            .andExpect(jsonPath("$[1].key").value("connectorInstanceTag"))
            .andExpect(jsonPath("$[1].type").value("text"))
            .andExpect(jsonPath("$[2].title").value("Endpoint Reference"))
            .andExpect(jsonPath("$[2].key").value("endpointOperation"))
            .andExpect(jsonPath("$[2].type").value("text"))
    }

    @Test
    fun `should get iko ikoViews`() {
        val pageable = PageRequest.of(0, 10)
        whenever(service.findAll(eq("klant"), eq("Klant"), isNull(), any())).thenReturn(
            PageImpl(
                listOf(IkoView(key = "klant", title = "Klant", ikoRepositoryConfig = mock())),
                pageable,
                1
            )
        )

        mockMvc.perform(get("/api/management/v1/iko-view?key={key}&title={title}", "klant", "Klant"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].key").value("klant"))
            .andExpect(jsonPath("$.content[0].title").value("Klant"))
    }

    @Test
    fun `should get iko ikoView by key`() {
        whenever(service.getByKey("klant")).thenReturn(
            IkoView(
                key = "klant",
                title = "Klant",
                properties = mapOf(
                    "connectorTag" to "brp",
                    "connectorInstanceTag" to "brp-1",
                    "endpointOperation" to "personen"
                ),
                ikoRepositoryConfig = mock()
            )
        )

        mockMvc.perform(get("/api/management/v1/iko-view/{ikoViewKey}", "klant"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("klant"))
            .andExpect(jsonPath("$.title").value("Klant"))
            .andExpect(jsonPath("$.properties.connectorTag").value("brp"))
            .andExpect(jsonPath("$.properties.connectorInstanceTag").value("brp-1"))
            .andExpect(jsonPath("$.properties.endpointOperation").value("personen"))
    }

    @Test
    fun `should create iko ikoView`() {
        val ikoView = IkoView(
            key = "klant",
            title = "Klant",
            properties = mapOf(
                "connectorTag" to "brp",
                "connectorInstanceTag" to "brp-1",
                "endpointOperation" to "personen"
            ),
            ikoRepositoryConfig = IkoRepositoryConfig("iko-api", "IKO API", "iko")
        )
        val request = IkoViewCreateRequest(
            ikoView.ikoRepositoryConfig.key,
            ikoView.title,
            ikoView.properties
        )
        whenever(
            service.createIkoView(
                ikoView.key,
                ikoView.ikoRepositoryConfig.key,
                ikoView.title,
                ikoView.properties
            )
        )
            .thenReturn(ikoView)

        mockMvc.perform(
            post("/api/management/v1/iko-view/{ikoViewKey}", "klant")
                .content(objectMapper.writeValueAsString(request))
                .contentType(APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("klant"))
            .andExpect(jsonPath("$.title").value("Klant"))
            .andExpect(jsonPath("$.properties.connectorTag").value("brp"))
            .andExpect(jsonPath("$.properties.connectorInstanceTag").value("brp-1"))
            .andExpect(jsonPath("$.properties.endpointOperation").value("personen"))
    }

    @Test
    fun `should update iko ikoView`() {
        val ikoView = IkoView(
            key = "klant",
            title = "Klant",
            properties = mapOf(
                "connectorTag" to "brp",
                "connectorInstanceTag" to "brp-1",
                "endpointOperation" to "personen"
            ),
            ikoRepositoryConfig = IkoRepositoryConfig("iko-api", "IKO API", "iko")
        )
        val request = IkoViewUpdateRequest(
            ikoView.ikoRepositoryConfig.key,
            ikoView.title,
            ikoView.properties
        )
        whenever(
            service.saveIkoView(
                ikoView.key,
                ikoView.ikoRepositoryConfig.key,
                ikoView.title,
                ikoView.properties
            )
        )
            .thenReturn(ikoView)
        mockMvc.perform(
            put("/api/management/v1/iko-view/{ikoViewKey}", "klant")
                .content(objectMapper.writeValueAsString(request))
                .contentType(APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.key").value("klant"))
            .andExpect(jsonPath("$.title").value("Klant"))
            .andExpect(jsonPath("$.properties.connectorTag").value("brp"))
            .andExpect(jsonPath("$.properties.connectorInstanceTag").value("brp-1"))
            .andExpect(jsonPath("$.properties.endpointOperation").value("personen"))
    }

    @Test
    fun `should delete iko ikoView`() {
        mockMvc.perform(delete("/api/management/v1/iko-view/{ikoViewKey}", "klant"))
            .andDo(print())
            .andExpect(status().isNoContent())
    }

}
