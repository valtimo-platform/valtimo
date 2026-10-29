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

package com.ritense.case_.service.migration

import com.ritense.BaseIntegrationTest
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

/** The lineage half of the pre-filled plan against a real database: the deployed set is read with a derived query and has to include the inactive `-migrated` definition an upgrade leaves behind. */
@Transactional
class CaseVersionLineageIntTest @Autowired constructor(
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val caseMigrationCandidateProvider: CaseMigrationCandidateProvider,
    private val migrationSuggestionService: MigrationSuggestionService,
) : BaseIntegrationTest() {

    @Test
    fun `every deployed version of the key is found, the inactive ones included`() {
        deploy("0.1.0-migrated", active = false)
        deploy("1.0.0", active = true)

        val versionTags = caseMigrationCandidateProvider.deployedVersionTags(target)

        assertThat(versionTags).containsExactlyInAnyOrder(
            Semver.parse("0.1.0-migrated"),
            Semver.parse("1.0.0"),
        )
    }

    @Test
    fun `a new plan on a version with no recorded predecessor is suggested the version below it`() {
        // The 12-to-13 upgrade shape: neither 1.0.0 nor 0.1.0-migrated records a `basedOnVersionTag`, so the suggestion used to come back with no source and therefore no components.
        deploy("0.1.0-migrated", active = false)
        deploy("1.0.0", active = true)

        val plan = migrationSuggestionService.suggestPlan(target)

        assertThat(plan.get("source").get("key").asText()).isEqualTo(KEY)
        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("0.1.0-migrated")
    }

    @Test
    fun `the recorded predecessor still wins where there is one`() {
        deploy("1.0.0", active = false)
        deploy("1.0.1", active = false)
        deploy("1.0.2", active = true, basedOn = "1.0.0")

        val plan = migrationSuggestionService.suggestPlan(CaseDefinitionId(KEY, "1.0.2"))

        assertThat(plan.get("source").get("versionTag").asText()).isEqualTo("1.0.0")
    }

    @Test
    fun `the only version there is gets no source`() {
        deploy("1.0.0", active = true)

        val plan = migrationSuggestionService.suggestPlan(target)

        assertThat(plan.has("source")).isFalse()
    }

    private fun deploy(versionTag: String, active: Boolean, basedOn: String? = null) {
        caseDefinitionRepository.saveAndFlush(
            CaseDefinition(
                id = CaseDefinitionId(KEY, versionTag),
                name = KEY,
                createdDate = null,
                basedOnVersionTag = basedOn?.let { Semver.parse(it) },
                active = active,
            )
        )
    }

    private val target = CaseDefinitionId(KEY, "1.0.0")

    private companion object {
        // Unique to this test, so the fixtures other tests deploy cannot answer for it.
        const val KEY = "case-version-lineage-int-test"
    }
}
