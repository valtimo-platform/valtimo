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

package com.ritense.deployerapi.security.config

import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.deployerapi.web.rest.DeployerCaseDefinitionResource
import com.ritense.deployerapi.web.rest.DeployerOpenApiResource
import com.ritense.exporter.ExportService
import com.ritense.importer.ImportService
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.ImportAutoConfiguration
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.test.context.support.WithAnonymousUser
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.security.web.SecurityFilterChain
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@SpringBootTest(classes = [DeployerApiHttpSecurityConfigurerTest.TestConfiguration::class])
@AutoConfigureMockMvc
class DeployerApiHttpSecurityConfigurerTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Test
    @WithAnonymousUser
    fun `should deny an anonymous caller`() {
        mockMvc.perform(get(CASE_DEFINITION_URL)).andExpect(status().isUnauthorized)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_USER"])
    fun `should deny a caller without the admin role`() {
        mockMvc.perform(get(CASE_DEFINITION_URL)).andExpect(status().isForbidden)
        mockMvc.perform(get(EXPORT_URL)).andExpect(status().isForbidden)
        mockMvc.perform(post(IMPORT_URL)).andExpect(status().isForbidden)
        mockMvc.perform(get(DANGLING_URL)).andExpect(status().isForbidden)
        mockMvc.perform(put(MAPPINGS_URL)).andExpect(status().isForbidden)
        mockMvc.perform(get(OPENAPI_URL)).andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_ADMIN"])
    fun `should allow a caller with the admin role`() {
        mockMvc.perform(get(CASE_DEFINITION_URL)).andExpect(status().isOk)
        mockMvc.perform(get(DANGLING_URL)).andExpect(status().isOk)
        mockMvc.perform(get(OPENAPI_URL)).andExpect(status().isFound)
    }

    @Test
    @WithMockUser(authorities = ["ROLE_DEPLOYER"])
    fun `should allow a caller with only the deployer role`() {
        mockMvc.perform(get(CASE_DEFINITION_URL)).andExpect(status().isOk)
        mockMvc.perform(get(DANGLING_URL)).andExpect(status().isOk)
        mockMvc.perform(get(OPENAPI_URL)).andExpect(status().isFound)
    }

    @Configuration
    @ImportAutoConfiguration(
        DispatcherServletAutoConfiguration::class,
        WebMvcAutoConfiguration::class,
        HttpMessageConvertersAutoConfiguration::class,
        JacksonAutoConfiguration::class,
        SecurityAutoConfiguration::class,
    )
    class TestConfiguration {

        @Bean
        fun deployerApiHttpSecurityConfigurer() = DeployerApiHttpSecurityConfigurer()

        @Bean
        fun deployerCaseDefinitionResource(
            caseDefinitionService: CaseDefinitionService,
            exportService: ExportService,
            importService: ImportService,
            caseDefinitionRepository: CaseDefinitionRepository,
        ) = DeployerCaseDefinitionResource(
            caseDefinitionService,
            exportService,
            importService,
            caseDefinitionRepository,
            emptyList(),
        )

        @Bean
        fun deployerOpenApiResource() = DeployerOpenApiResource()

        @Bean
        fun caseDefinitionService(): CaseDefinitionService = mock()

        @Bean
        fun exportService(): ExportService = mock()

        @Bean
        fun importService(): ImportService = mock()

        @Bean
        fun caseDefinitionRepository(): CaseDefinitionRepository = mock {
            on { existsById(any()) } doReturn true
        }

        @Bean
        fun securityFilterChain(
            http: HttpSecurity,
            configurer: DeployerApiHttpSecurityConfigurer,
        ): SecurityFilterChain {
            configurer.configure(http)
            http.csrf { it.disable() }
            http.httpBasic { }
            http.authorizeHttpRequests { it.anyRequest().denyAll() }
            return http.build()
        }
    }

    companion object {
        private const val CASE_DEFINITION_URL = "/api/deployer/v1/case-definition"
        private const val EXPORT_URL = "/api/deployer/v1/case-definition/my-case/version/1.0.0/export"
        private const val IMPORT_URL = "/api/deployer/v1/case-definition/import"
        private const val DANGLING_URL =
            "/api/deployer/v1/case-definition/my-case/version/1.0.0/dangling-plugin-configurations"
        private const val MAPPINGS_URL =
            "/api/deployer/v1/case-definition/my-case/version/1.0.0/plugin-configuration-mappings"
        private const val OPENAPI_URL = "/api/deployer/v1/openapi.json"
    }
}
