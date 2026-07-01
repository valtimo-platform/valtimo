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

package com.ritense.objectmanagement.web.rest

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.net.URI
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.util.UUID

internal class ObjectManagementObjectResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var objectManagementService: ObjectManagementService
    lateinit var objectManagementObjectResource: ObjectManagementObjectResource

    @BeforeEach
    fun init() {
        objectManagementService = mock()
        objectManagementObjectResource = ObjectManagementObjectResource(objectManagementService)

        val mappingJackson2HttpMessageConverter = MappingJackson2HttpMessageConverter()
        mappingJackson2HttpMessageConverter.objectMapper = MapperSingleton.get()

        mockMvc = MockMvcBuilders
            .standaloneSetup(objectManagementObjectResource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(mappingJackson2HttpMessageConverter)
            .build()
    }

    @Test
    fun `should return 400 when neither id nor title provided`() {
        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `should return 400 when both id and title provided`() {
        val id = UUID.randomUUID()

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("id", id.toString())
                .param("title", "TestConfig")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `should get objects by config id`() {
        val configId = UUID.randomUUID()
        val objectUuid = UUID.randomUUID()
        val objectWrapper = createObjectWrapper(objectUuid)
        val page = PageImpl(listOf(objectWrapper), PageRequest.of(0, 20), 1)

        whenever(objectManagementService.getObjectsByConfig(eq(configId), isNull(), isNull(), any()))
            .thenReturn(page)

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("id", configId.toString())
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[0].uuid").value(objectUuid.toString()))
            .andExpect(jsonPath("$.totalElements").value(1))

        verify(objectManagementService).getObjectsByConfig(eq(configId), isNull(), isNull(), any())
    }

    @Test
    fun `should get objects by config title`() {
        val title = "TestConfig"
        val objectUuid = UUID.randomUUID()
        val objectWrapper = createObjectWrapper(objectUuid)
        val page = PageImpl(listOf(objectWrapper), PageRequest.of(0, 20), 1)

        whenever(objectManagementService.getObjectsByConfig(isNull(), eq(title), isNull(), any()))
            .thenReturn(page)

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", title)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[0].uuid").value(objectUuid.toString()))

        verify(objectManagementService).getObjectsByConfig(isNull(), eq(title), isNull(), any())
    }

    @Test
    fun `should pass dataAttrs filter to service`() {
        val title = "TestConfig"
        val dataAttrs = "name__icontains__test"
        val objectUuid = UUID.randomUUID()
        val objectWrapper = createObjectWrapper(objectUuid)
        val page = PageImpl(listOf(objectWrapper), PageRequest.of(0, 20), 1)

        whenever(objectManagementService.getObjectsByConfig(isNull(), eq(title), eq(dataAttrs), any()))
            .thenReturn(page)

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", title)
                .param("dataAttrs", dataAttrs)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)

        verify(objectManagementService).getObjectsByConfig(isNull(), eq(title), eq(dataAttrs), any())
    }

    @Test
    fun `should return 400 with empty body when service rejects invalid dataAttrs`() {
        val title = "TestConfig"
        val dataAttrs = "name__bogus__x"

        whenever(objectManagementService.getObjectsByConfig(isNull(), eq(title), eq(dataAttrs), any()))
            .thenThrow(IllegalArgumentException("Unknown comparator: 'bogus'"))

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", title)
                .param("dataAttrs", dataAttrs)
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
            .andExpect(content().string(""))
    }

    @Test
    fun `should support pagination parameters`() {
        val title = "TestConfig"
        val objectWrapper = createObjectWrapper(UUID.randomUUID())
        val page = PageImpl(listOf(objectWrapper), PageRequest.of(2, 10), 30)

        whenever(objectManagementService.getObjectsByConfig(isNull(), eq(title), isNull(), any()))
            .thenReturn(page)

        mockMvc.perform(
            get("/api/v1/object-management/objects")
                .param("title", title)
                .param("page", "2")
                .param("size", "10")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(30))
            .andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.number").value(2))
    }

    private fun createObjectWrapper(uuid: UUID): ObjectWrapper {
        return ObjectWrapper(
            url = URI("https://example.com/objects/$uuid"),
            uuid = uuid,
            type = URI("https://example.com/objecttypes/test"),
            record = ObjectRecord(
                index = 1,
                typeVersion = 1,
                data = JsonNodeFactory.instance.objectNode().put("name", "Test Object"),
                geometry = null,
                startAt = LocalDate.now(),
                endAt = null,
                registrationAt = LocalDate.now(),
                correctionFor = null,
                correctedBy = null
            )
        )
    }
}
