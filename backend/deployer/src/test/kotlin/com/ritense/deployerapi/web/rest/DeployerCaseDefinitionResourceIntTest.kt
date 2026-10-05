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

package com.ritense.deployerapi.web.rest

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.deployerapi.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.Base64
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@WithMockUser(authorities = ["ROLE_DEPLOYER"])
class DeployerCaseDefinitionResourceIntTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) : BaseIntegrationTest() {

    @Test
    fun `should list the auto-deployed case definition`() {
        mockMvc.perform(get("$BASE_PATH/case-definition").param("caseDefinitionKey", CASE_KEY))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].caseDefinitionKey").value(CASE_KEY))
            .andExpect(jsonPath("$[0].caseDefinitionVersionTag").value(VERSION_TAG))
    }

    @Test
    fun `should report bad request with an error body for an unparsable query parameter`() {
        val response = mockMvc.perform(get("$BASE_PATH/case-definition").param("active", "not-a-boolean"))
            .andExpect(status().isBadRequest)
            .andReturn().response

        assertContains(response.contentAsString, "\"message\"")
    }

    @Test
    fun `should export and import a case definition under a new key`() {
        val zip = mockMvc.perform(get("$BASE_PATH/case-definition/$CASE_KEY/version/$VERSION_TAG/export"))
            .andExpect(status().isOk)
            .andReturn().response.contentAsByteArray

        assertTrue(zip.isNotEmpty(), "export produced an empty archive")

        mockMvc.perform(
            post("$BASE_PATH/case-definition/import")
                .param("key", IMPORTED_CASE_KEY)
                .param("name", "Imported by the deployer")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"file":"${Base64.getEncoder().encodeToString(zip)}"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionId.key").value(IMPORTED_CASE_KEY))

        val imported = caseDefinitionRepository
            .findById(CaseDefinitionId.of(IMPORTED_CASE_KEY, VERSION_TAG))
        assertTrue(imported.isPresent, "imported case definition was not persisted")
    }

    @Test
    fun `should report not found with an error body for an unknown case definition`() {
        val response = mockMvc.perform(get("$BASE_PATH/case-definition/does-not-exist/version/1.0.0/export"))
            .andExpect(status().isNotFound)
            .andReturn().response

        assertContains(response.contentAsString, "\"message\"")
    }

    @Test
    fun `should report bad request with an error body for an archive that is not a case definition`() {
        val response = mockMvc.perform(
            post("$BASE_PATH/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"file":"${Base64.getEncoder().encodeToString("not a zip".toByteArray())}"}""")
        )
            .andExpect(status().isBadRequest)
            .andReturn().response

        assertNotNull(response.contentAsString)
        assertContains(response.contentAsString, "\"message\"")
    }

    @Test
    fun `should deny a method the security config does not list`() {
        mockMvc.perform(post("$BASE_PATH/case-definition"))
            .andExpect(status().isForbidden)
    }

    @Test
    fun `should publish the deployer openapi group`() {
        val document = mockMvc.perform(get("/v3/api-docs/deployer"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.paths['/api/deployer/v1/case-definition']").exists())
            .andExpect(jsonPath("$.paths['/api/deployer/v1/case-definition/import']").exists())
            .andExpect(jsonPath("$.components.schemas.FieldErrorVM").doesNotExist())
            .andReturn().response.contentAsString

        val declared = jacksonObjectMapper().readTree(document)
            .path("components").path("schemas").fieldNames().asSequence().toSet()
        val referenced = REF_PATTERN.findAll(document).map { it.groupValues[1] }.toSet()

        assertEquals(emptySet(), referenced - declared, "spec references schemas it does not declare")
    }

    companion object {
        private val REF_PATTERN = "\"\\\$ref\"\\s*:\\s*\"#/components/schemas/([^\"]+)\"".toRegex()
        private const val BASE_PATH = "/api/deployer/v1"
        private const val CASE_KEY = "deployer-case"
        private const val IMPORTED_CASE_KEY = "deployer-case-copy"
        private const val VERSION_TAG = "1.0.0"
    }
}
