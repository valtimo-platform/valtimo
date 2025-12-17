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

import com.ritense.iko.domain.IkoView
import com.ritense.iko.service.IkoViewService
import com.ritense.valtimo.contract.json.MapperSingleton
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
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional

@Transactional
internal class IkoViewResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var resource: IkoViewResource
    private lateinit var service: IkoViewService

    @BeforeEach
    fun init() {
        service = mock()
        resource = IkoViewResource(service)
        mockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(MapperSingleton.get()))
            .build();
    }

    @Test
    fun `should get ikoViews`() {
        val pageable = PageRequest.of(0, 10)
        whenever(service.findAll(eq("klant"), eq("Klant"), isNull(), any())).thenReturn(
            PageImpl(
                listOf(IkoView(key = "klant", title = "Klant", ikoRepositoryConfig = mock())),
                pageable,
                1
            )
        )

        mockMvc.perform(get("/api/v1/iko-view?key={key}&title={title}", "klant", "Klant"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].key").value("klant"))
            .andExpect(jsonPath("$.content[0].title").value("Klant"))
    }

}
