/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

package com.ritense.resource.web.rest

import com.nhaarman.mockitokotlin2.any
import com.nhaarman.mockitokotlin2.doReturn
import com.nhaarman.mockitokotlin2.mock
import com.nhaarman.mockitokotlin2.whenever
import com.ritense.resource.BaseTest
import com.ritense.resource.domain.ResourceId
import com.ritense.resource.service.S3Service
import com.ritense.resource.web.ObjectUrlDTO
import com.ritense.resource.web.ResourceDTO
import com.ritense.valtimo.contract.json.Mapper
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.http.MediaType.APPLICATION_JSON_VALUE
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.net.URL
import java.nio.charset.StandardCharsets
import java.time.LocalDateTime
import java.util.UUID

class S3ResourceTest : BaseTest() {

    lateinit var mockMvc: MockMvc
    lateinit var s3Service: S3Service
    lateinit var s3Resource: S3Resource

    @BeforeEach
    fun init() {
        s3Service = mock {
            on { generatePreSignedPutObjectUrl(any()) } doReturn URL("http://myfile")
        }
        s3Resource = S3Resource(s3Service)
        mockMvc = MockMvcBuilders
            .standaloneSetup(s3Resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .build()
    }

    @Test
    fun `should return ok when getting pre-signed url for filename`() {
        mockMvc.perform(get("/api/v1/resource/pre-signed-url/{fileName}", "myfile")
            .characterEncoding(StandardCharsets.UTF_8.name())
            .contentType(APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(content().contentType("text/plain;charset=UTF-8"))
            .andExpect(jsonPath("$").value("http://myfile"))
    }

    @Test
    fun `should return ok when get resource url`() {
        val resourceId = UUID.randomUUID()
        val s3ResourceDTO = ResourceDTO(null, "key", "name", "extension", 100L, LocalDateTime.now())
        val objectUrlDTO = ObjectUrlDTO(URL("http://www.nu.nl"), s3ResourceDTO)
        whenever(s3Service.getResourceUrl(resourceId)).thenReturn(objectUrlDTO)

        mockMvc.perform(get("/api/v1/resource/{resourceId}", resourceId)
            .characterEncoding(StandardCharsets.UTF_8.name())
            .contentType(APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(content().contentType(APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isNotEmpty)
            .andExpect(jsonPath("$.url").value(objectUrlDTO.url.toString()))
            .andExpect(jsonPath("$.resource.key").value(objectUrlDTO.resource.key))
            .andExpect(jsonPath("$.resource.name").value(objectUrlDTO.resource.name))
    }

    @Test
    fun `should return ok when deleting resource`() {
        val resourceId = UUID.randomUUID()
        mockMvc.perform(delete("/api/v1/resource/{resourceId}", resourceId)
            .contentType(APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should return ok when registering resource`() {
        val resourceDTO = ResourceDTO(null, "key", "name", "extension", 100L, null)

        val resourceDTOCreated = ResourceDTO(
            UUID.randomUUID().toString(),
            resourceDTO.key,
            resourceDTO.name,
            resourceDTO.extension,
            resourceDTO.sizeInBytes,
            LocalDateTime.now()
        )

        whenever(s3Service.registerResource(any())).thenReturn(resourceDTOCreated)

        mockMvc.perform(put("/api/v1/resource")
            .characterEncoding(StandardCharsets.UTF_8.name())
            .content(Mapper.INSTANCE.get().writeValueAsString(resourceDTO))
            .contentType(APPLICATION_JSON_VALUE))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(content().contentType(APPLICATION_JSON_VALUE))
            .andExpect(jsonPath("$").isNotEmpty)
    }

    private fun s3Resource(): com.ritense.resource.domain.S3Resource {
        return com.ritense.resource.domain.S3Resource(
            ResourceId.newId(UUID.randomUUID()),
            "aBucketName",
            "aKeyName",
            "aFileName",
            "extension",
            10L,
            LocalDateTime.now()
        )
    }

}