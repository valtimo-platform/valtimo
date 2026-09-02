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

package com.ritense.case.web.rest

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.hamcrest.Matchers.greaterThan
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext

@Transactional
class CaseDefinitionVersionListingIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var caseDefinitionRepository: CaseDefinitionRepository

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should list every version when the caller asks for a page big enough to hold them`() {
        val key = "version-listing-all"
        deployVersions(key, count = 9)

        mockMvc
            .perform(get(VERSIONS_PATH, key).param("size", "100").contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(9))
            .andExpect(jsonPath("$[0].versionTag").value("1.0.9"))
            .andExpect(jsonPath("$[8].versionTag").value("1.0.1"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should silently truncate a version list for a caller that asks no size`() {
        val key = "version-listing-default-page"
        deployVersions(key, count = 9)

        mockMvc
            .perform(get(VERSIONS_PATH, key).contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(5))
            .andExpect(jsonPath("$[0].versionTag").value("1.0.9"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should list every version of a key when the management list is asked for all versions`() {
        val key = "management-list-all-versions"
        deployVersions(key, count = 9)

        mockMvc
            .perform(
                get(MANAGEMENT_LIST_PATH)
                    .param("caseDefinitionKey", key)
                    .param("allVersions", "true")
                    .param("size", "100")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(9))
            .andExpect(jsonPath("$.content.length()").value(9))
            .andExpect(jsonPath("$.content[0].caseDefinitionVersionTag").value("1.0.9"))
            .andExpect(jsonPath("$.content[8].caseDefinitionVersionTag").value("1.0.1"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should list only the active version of a key by default`() {
        val key = "management-list-latest-only"
        deployVersions(key, count = 9)

        mockMvc
            .perform(
                get(MANAGEMENT_LIST_PATH)
                    .param("caseDefinitionKey", key)
                    .param("size", "100")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].caseDefinitionVersionTag").value("1.0.9"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should order the management list by the requested version tag rather than the default`() {
        val key = "management-list-sorted-asc"
        deployVersions(key, count = 10)

        mockMvc
            .perform(
                get(MANAGEMENT_LIST_PATH)
                    .param("caseDefinitionKey", key)
                    .param("allVersions", "true")
                    .param("sort", "id.versionTag,asc")
                    .param("size", "100")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content.length()").value(10))
            // Ordering the version tag as a string would end on 1.0.9 and put 1.0.10 second.
            .andExpect(jsonPath("$.content[0].caseDefinitionVersionTag").value("1.0.1"))
            .andExpect(jsonPath("$.content[1].caseDefinitionVersionTag").value("1.0.2"))
            .andExpect(jsonPath("$.content[9].caseDefinitionVersionTag").value("1.0.10"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should refuse a management list sort on a property that is not sortable`() {
        mockMvc
            .perform(
                get(MANAGEMENT_LIST_PATH)
                    .param("sort", "description,desc")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
            .andExpect(status().isBadRequest)
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should return an empty page for a page index beyond the result set`() {
        deployVersions("management-list-beyond-end", count = 2)

        // An offset past Int.MAX_VALUE used to wrap negative and throw out of subList instead of paging past the end.
        mockMvc
            .perform(
                get(MANAGEMENT_LIST_PATH)
                    .param("page", "3000000")
                    .param("size", "1000")
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content.length()").value(0))
            .andExpect(jsonPath("$.totalElements").value(greaterThan(0)))
    }

    private fun deployVersions(key: String, count: Int) {
        runWithoutAuthorization {
            (1..count).forEach { minor ->
                caseDefinitionRepository.saveAndFlush(
                    CaseDefinition(
                        id = CaseDefinitionId(key, "1.0.$minor"),
                        name = key,
                        createdDate = null,
                        active = minor == count,
                    )
                )
            }
        }
    }

    private companion object {
        const val VERSIONS_PATH = "/api/management/v1/case-definition/{caseDefinitionKey}/version"
        const val MANAGEMENT_LIST_PATH = "/api/management/v1/case-definition"
    }
}
