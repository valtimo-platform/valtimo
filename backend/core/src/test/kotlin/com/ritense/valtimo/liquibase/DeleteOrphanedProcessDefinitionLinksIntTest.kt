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

package com.ritense.valtimo.liquibase

import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.config.LiquibaseRunner
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

class DeleteOrphanedProcessDefinitionLinksIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var liquibaseRunner: LiquibaseRunner

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    companion object {
        const val CHANGESET_FILENAME = "13-42-0/20260813-delete-orphaned-process-definition-case-definition.xml"
    }

    @AfterEach
    fun cleanup() {
        TransactionTemplate(transactionManager).execute {
            jdbcTemplate.update("DELETE FROM process_definition_case_definition WHERE case_definition_key IN ('valid-case', 'orphan-case')")
            jdbcTemplate.update("DELETE FROM process_link WHERE activity_id IN ('TestServiceTask', 'SomeTask')")
        }
    }

    @Test
    fun `changeset should delete orphaned process_definition_case_definition rows`() {
        val txTemplate = TransactionTemplate(transactionManager)

        val validProcDefId = txTemplate.execute {
            repositoryService.createDeployment()
                .addClasspathResource("config/global/bpmn/test-process.bpmn")
                .deployWithResult()
                .deployedProcessDefinitions
                .first()
                .id
        }!!

        txTemplate.execute {
            jdbcTemplate.update(
                """
                INSERT INTO process_definition_case_definition
                (process_definition_id, case_definition_key, case_definition_version_tag, can_initialize_document, startable_by_user)
                VALUES (?, 'valid-case', '1.0.0', false, true)
                """.trimIndent(),
                validProcDefId
            )

            jdbcTemplate.update(
                """
                INSERT INTO process_definition_case_definition
                (process_definition_id, case_definition_key, case_definition_version_tag, can_initialize_document, startable_by_user)
                VALUES ('non-existent:1:12345', 'orphan-case', '1.0.0', false, true)
                """
            )
        }

        val totalCountBefore = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_definition_case_definition",
            Int::class.java
        )

        val orphanCountBefore = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_definition_case_definition WHERE case_definition_key = 'orphan-case'",
            Int::class.java
        )
        assertThat(orphanCountBefore).isEqualTo(1)

        txTemplate.execute {
            jdbcTemplate.update(
                """
                DELETE FROM DATABASECHANGELOG
                WHERE FILENAME LIKE '%20260813-delete-orphaned%' AND AUTHOR = 'Ritense' AND ID = '1'
                """.trimIndent()
            )
        }

        liquibaseRunner.run()

        val validCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_definition_case_definition WHERE case_definition_key = 'valid-case'",
            Int::class.java
        )
        assertThat(validCountAfter).isEqualTo(1)

        val orphanCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_definition_case_definition WHERE case_definition_key = 'orphan-case'",
            Int::class.java
        )
        assertThat(orphanCountAfter).isEqualTo(0)

        val totalCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_definition_case_definition",
            Int::class.java
        )
        assertThat(totalCountAfter).isEqualTo(totalCountBefore!! - 1)
    }

    @Test
    fun `changeset should delete orphaned process_link rows`() {
        val txTemplate = TransactionTemplate(transactionManager)

        val validProcDefId = txTemplate.execute {
            repositoryService.createDeployment()
                .addClasspathResource("config/global/bpmn/test-process.bpmn")
                .deployWithResult()
                .deployedProcessDefinitions
                .first()
                .id
        }!!

        val validLinkId = UUID.randomUUID()
        val orphanLinkId = UUID.randomUUID()

        txTemplate.execute {
            jdbcTemplate.update(
                """
                INSERT INTO process_link
                (id, process_definition_id, activity_id, activity_type, process_link_type)
                VALUES (?, ?, 'TestServiceTask', 'bpmn:ServiceTask:start', 'test')
                """.trimIndent(),
                validLinkId,
                validProcDefId
            )

            jdbcTemplate.update(
                """
                INSERT INTO process_link
                (id, process_definition_id, activity_id, activity_type, process_link_type)
                VALUES (?, 'non-existent:1:12345', 'SomeTask', 'bpmn:ServiceTask:start', 'test')
                """.trimIndent(),
                orphanLinkId
            )
        }

        val totalCountBefore = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_link",
            Int::class.java
        )

        val orphanCountBefore = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_link WHERE id = ?",
            Int::class.java,
            orphanLinkId
        )
        assertThat(orphanCountBefore).isEqualTo(1)

        txTemplate.execute {
            jdbcTemplate.update(
                """
                DELETE FROM DATABASECHANGELOG
                WHERE FILENAME LIKE '%20260813-delete-orphaned%' AND AUTHOR = 'Ritense' AND ID = '2'
                """.trimIndent()
            )
        }

        liquibaseRunner.run()

        val validCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_link WHERE id = ?",
            Int::class.java,
            validLinkId
        )
        assertThat(validCountAfter).isEqualTo(1)

        val orphanCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_link WHERE id = ?",
            Int::class.java,
            orphanLinkId
        )
        assertThat(orphanCountAfter).isEqualTo(0)

        val totalCountAfter = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM process_link",
            Int::class.java
        )
        assertThat(totalCountAfter).isEqualTo(totalCountBefore!! - 1)
    }
}
