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

package com.ritense.case.service

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseDefinitionManagementListingIntTest @Autowired constructor(
    private val caseDefinitionService: CaseDefinitionService
) : BaseIntegrationTest() {

    @Test
    fun `should list one version per case definition key by default`() {
        val caseDefinitions = runWithoutAuthorization {
            caseDefinitionService.getCaseDefinitionsForManagement(pageable = PageRequest.of(0, 1000))
        }

        assertThat(caseDefinitions.content.filter { it.id.key == CASE_DEFINITION_KEY }).hasSizeLessThanOrEqualTo(1)
    }

    @Test
    fun `should list every version of every case definition key when all versions are requested`() {
        val caseDefinitions = runWithoutAuthorization {
            caseDefinitionService.getCaseDefinitionsForManagement(
                allVersions = true,
                pageable = PageRequest.of(0, 1000)
            )
        }

        // No explicit sort — tie-breaker: key asc, version desc
        assertThat(
            caseDefinitions.content
                .filter { it.id.key == CASE_DEFINITION_KEY }
                .map { it.id.versionTag.toString() }
        ).containsExactly("1.2.3", "0.0.1")
    }

    @Test
    fun `should return an empty page for a page index beyond the result set`() {
        // An offset past Int.MAX_VALUE used to wrap negative and throw out of subList instead of paging past the end.
        val caseDefinitions = runWithoutAuthorization {
            caseDefinitionService.getCaseDefinitionsForManagement(pageable = PageRequest.of(3_000_000, 1000))
        }

        assertThat(caseDefinitions.content).isEmpty()
        assertThat(caseDefinitions.totalElements).isGreaterThan(0)
    }

    private companion object {
        const val CASE_DEFINITION_KEY = "some-case-type"
    }
}
