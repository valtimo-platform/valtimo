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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** The cursor on both databases: `:afterId IS NULL` compiles in HQL and can still fail at the driver. Never asserted in `UUID.compareTo` order. */
@Transactional
class CaseMigrationCandidateCursorIntTest @Autowired constructor(
    private val caseMigrationCandidateProvider: CaseMigrationCandidateProvider,
) : BaseIntegrationTest() {

    @Test
    fun `the first batch takes a null cursor and honours the limit`() {
        val created = createCases(5)

        val all = caseMigrationCandidateProvider.findCandidateIds(source, null, LIMIT)

        assertThat(all).containsAll(created)
        assertThat(caseMigrationCandidateProvider.findCandidateIds(source, null, 2)).isEqualTo(all.take(2))
        assertThat(caseMigrationCandidateProvider.findCandidateIds(source, null, 1)).isEqualTo(all.take(1))
    }

    @Test
    fun `every id partitions the set into what it has walked and what is left`() {
        createCases(5)
        val all = caseMigrationCandidateProvider.findCandidateIds(source, null, LIMIT)

        // What the scan loop rests on: after `all[i]`, the next call sees the rest and nothing else.
        all.indices.forEach { i ->
            assertThat(caseMigrationCandidateProvider.findCandidateIds(source, all[i], LIMIT))
                .`as`("the tail after element $i")
                .isEqualTo(all.drop(i + 1))
        }
    }

    @Test
    fun `a cursor past the end of the set answers empty rather than wrapping around`() {
        createCases(2)

        // All-ones, not `UUID(MAX_VALUE, MAX_VALUE)`, is the greatest uuid a database orders.
        val beyondEverything = UUID(-1L, -1L)

        assertThat(caseMigrationCandidateProvider.findCandidateIds(source, beyondEverything, LIMIT)).isEmpty()
    }

    /** The skip check runs per case on every run, so a query that compiles in HQL and fails at the driver would break every migration. */
    @Test
    fun `isHomedOn answers true only for the version the case is actually on`() {
        val caseId = createCases(1).single()

        assertThat(caseMigrationCandidateProvider.isHomedOn(caseId, source)).isTrue()
        assertThat(caseMigrationCandidateProvider.isHomedOn(caseId, CaseDefinitionId(KEY, "0.0.1"))).isFalse()
        assertThat(caseMigrationCandidateProvider.isHomedOn(UUID.randomUUID(), source)).isFalse()
    }

    @Test
    fun `cases on another version of the same key are not candidates`() {
        createCases(1)

        val otherVersion = CaseDefinitionId(KEY, "0.0.1")

        assertThat(caseMigrationCandidateProvider.findCandidateIds(otherVersion, null, LIMIT)).isEmpty()
    }

    private fun createCases(count: Int): List<UUID> = runWithoutAuthorization {
        (1..count).map {
            documentService.createDocument(
                NewDocumentRequest(KEY, KEY, VERSION_TAG, MapperSingleton.get().createObjectNode())
            ).resultingDocument().orElseThrow().id().id
        }
    }

    private val source = CaseDefinitionId(KEY, VERSION_TAG)

    private companion object {
        // Auto-deployed by the test resources, document definition included.
        const val KEY = "some-case-type"
        const val VERSION_TAG = "1.2.3"
        const val LIMIT = 500
    }
}
