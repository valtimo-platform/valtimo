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

package com.ritense.exchange.web

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.context.web.WebAppConfiguration
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@ExtendWith(SpringExtension::class)
@WebAppConfiguration
@ContextConfiguration(classes = [ExchangeTestConfig::class])
class ExchangeResourceDisabledTest {

    @Autowired
    private lateinit var context: WebApplicationContext

    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = webAppContextSetup(context).apply<DefaultMockMvcBuilder>(springSecurity()).build()
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `management endpoints are not found when no url is configured`() {
        mockMvc
            .perform(get("/api/management/v1/exchange/publications/${UUID.randomUUID()}/artifacts/${UUID.randomUUID()}"))
            .andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_USER"])
    fun `configuration reports disabled`() {
        mockMvc.perform(get("/api/v1/exchange/configuration"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.enabled").value(false))
    }
}
