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

import com.ritense.iko.service.IkoTabService
import com.ritense.tab.domain.Tab
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import jakarta.validation.Validator
import org.springframework.aop.framework.ProxyFactory
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean
import org.springframework.validation.beanvalidation.MethodValidationInterceptor
import java.util.Optional

@Transactional
internal class IkoTabResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var resource: IkoTabResource
    private lateinit var service: IkoTabService

    @BeforeEach
    fun init() {
        service = mock()
        val validator = LocalValidatorFactoryBean().apply { afterPropertiesSet() }
        resource = ProxyFactory(IkoTabResource(service)).apply {
            addAdvice(MethodValidationInterceptor(validator as Validator))
        }.proxy as IkoTabResource
        mockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .setMessageConverters(MappingJackson2HttpMessageConverter(MapperSingleton.get()))
            .setValidator(validator)
            .setControllerAdvice(ExceptionTranslator(Optional.empty()))
            .build();
    }

    @Test
    fun `should get tabs`() {
        whenever(service.findAllTabsByIkoViewKey("klant"))
            .thenReturn(listOf(tab()))

        mockMvc.perform(get("/api/v1/iko-view/{ikoViewKey}/tab", "klant"))
            .andDo(print())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].key").value("naam"))
            .andExpect(jsonPath("$[0].title").value("Naam"))
            .andExpect(jsonPath("$[0].type").value("widgets"))
            .andExpect(jsonPath("$[0].properties.aggregatedDataProfileName").value("Personen"))
    }

    @Test
    fun `should reject get tabs when ikoViewKey exceeds path-variable cap`() {
        mockMvc.perform(get("/api/v1/iko-view/{ikoViewKey}/tab", "x".repeat(257)))
            .andDo(print())
            .andExpect(status().isBadRequest())
    }

    private fun tab() = Tab(
        key = "naam",
        title = "Naam",
        type = "widgets",
        order = 0,
        properties = mapOf (
            "aggregatedDataProfileName" to "Personen"
        )
    )
}
