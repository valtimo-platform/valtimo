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

package com.ritense.processdocument.liquibase.changelog

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.config.LiquibaseRunner
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime

class VersionLegacyCaseDefinitionProcessLinksIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var liquibaseRunner: LiquibaseRunner

    @Autowired
    lateinit var caseDefinitionRepository: CaseDefinitionRepository

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    @AfterEach
    fun cleanUp() {
        inTransaction {
            jdbcTemplate.update(
                "DELETE FROM case_definition_process_link WHERE case_definition_key IN (?, ?)",
                CASE_KEY,
                CASE_KEY_WITHOUT_MIGRATED_VERSION
            )
            caseDefinitionRepository.deleteById(MIGRATED_CASE_DEFINITION_ID)
        }
    }

    @Test
    fun `should give a legacy link the version tag of the migrated case definition`() {
        givenMigratedCaseDefinition()
        givenLegacyLink(CASE_KEY)

        runChangesets()

        assertThat(linksOf(CASE_KEY)).containsExactly("$MIGRATED_VERSION_TAG_IN_DB $UPLOAD_PROCESS DOCUMENT_UPLOAD")
    }

    @Test
    fun `should not duplicate a link the migrated case definition already has`() {
        givenMigratedCaseDefinition()
        givenLink(CASE_KEY, MIGRATED_VERSION_TAG_IN_DB, "other-upload-process")
        givenLegacyLink(CASE_KEY)

        runChangesets()

        assertThat(linksOf(CASE_KEY)).containsExactly("$MIGRATED_VERSION_TAG_IN_DB other-upload-process DOCUMENT_UPLOAD")
    }

    @Test
    fun `should delete a legacy link without a migrated case definition`() {
        givenLegacyLink(CASE_KEY_WITHOUT_MIGRATED_VERSION)

        runChangesets()

        assertThat(linksOf(CASE_KEY_WITHOUT_MIGRATED_VERSION)).isEmpty()
    }

    private fun givenMigratedCaseDefinition() {
        caseDefinitionRepository.save(
            CaseDefinition(
                id = MIGRATED_CASE_DEFINITION_ID,
                name = "Legacy case",
                createdDate = LocalDateTime.now(),
                final = true
            )
        )
    }

    private fun givenLegacyLink(caseDefinitionKey: String) = givenLink(caseDefinitionKey, null, UPLOAD_PROCESS)

    private fun givenLink(caseDefinitionKey: String, versionTag: String?, processDefinitionKey: String) = inTransaction {
        jdbcTemplate.update(
            """
            INSERT INTO case_definition_process_link
            (case_definition_key, case_definition_version_tag, process_definition_key, link_type)
            VALUES (?, ?, ?, 'DOCUMENT_UPLOAD')
            """.trimIndent(),
            caseDefinitionKey,
            versionTag,
            processDefinitionKey
        )
    }

    private fun runChangesets() {
        inTransaction {
            jdbcTemplate.update("DELETE FROM DATABASECHANGELOG WHERE FILENAME LIKE '%$CHANGESET_FILENAME'")
        }
        liquibaseRunner.run()
    }

    // Test datasource has auto-commit off
    private fun inTransaction(block: () -> Unit) {
        TransactionTemplate(transactionManager).executeWithoutResult { block() }
    }

    private fun linksOf(caseDefinitionKey: String): List<String> = jdbcTemplate.queryForList(
        """
        SELECT case_definition_version_tag, process_definition_key, link_type
        FROM case_definition_process_link
        WHERE case_definition_key = ?
        """.trimIndent(),
        caseDefinitionKey
    ).map { "${it["case_definition_version_tag"]} ${it["process_definition_key"]} ${it["link_type"]}" }

    private companion object {
        const val CHANGESET_FILENAME = "20261115-version-legacy-case-definition-process-links.xml"
        const val CASE_KEY = "legacy-case"
        const val CASE_KEY_WITHOUT_MIGRATED_VERSION = "deleted-legacy-case"
        const val UPLOAD_PROCESS = "document-upload"
        const val MIGRATED_VERSION_TAG_IN_DB = "000000.000001.000000-migrated"
        val MIGRATED_CASE_DEFINITION_ID = CaseDefinitionId(CASE_KEY, "0.1.0-migrated")
    }
}
