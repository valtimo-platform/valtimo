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
import com.ritense.valtimo.contract.repository.SemverConverter
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

class RemoveDuplicateBuildingBlockProcessDefinitionLinksIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var liquibaseRunner: LiquibaseRunner

    @Autowired
    lateinit var transactionManager: PlatformTransactionManager

    private val deploymentIds = mutableListOf<String>()

    @AfterEach
    fun cleanup() {
        TransactionTemplate(transactionManager).execute {
            jdbcTemplate.update(
                "DELETE FROM process_definition_building_block_definition WHERE building_block_definition_key = ?",
                BUILDING_BLOCK_KEY
            )
            jdbcTemplate.update(
                "DELETE FROM building_block_definition WHERE building_block_definition_key = ?",
                BUILDING_BLOCK_KEY
            )
            deploymentIds.forEach { repositoryService.deleteDeployment(it, true) }
        }
    }

    @Test
    fun `changeset should keep the latest linked version per process and keep the main flag`() {
        val txTemplate = TransactionTemplate(transactionManager)
        txTemplate.execute {
            jdbcTemplate.update(
                """
                INSERT INTO building_block_definition
                (building_block_definition_key, building_block_definition_version_tag, name, is_final)
                VALUES (?, ?, 'Duplicate links', false)
                """.trimIndent(),
                BUILDING_BLOCK_KEY,
                STORED_BUILDING_BLOCK_VERSION
            )
        }
        val staleMain = deploy("dedup-main", DETACHED_TAG)
        val attachedMain = deploy("dedup-main", ATTACHED_TAG)
        val olderSub = deploy("dedup-sub", DETACHED_TAG)
        val newerSub = deploy("dedup-sub", DETACHED_TAG)
        val firstOfThree = deploy("dedup-three", DETACHED_TAG)
        val secondOfThree = deploy("dedup-three", DETACHED_TAG)
        val latestOfThree = deploy("dedup-three", ATTACHED_TAG)
        val solo = deploy("dedup-solo", ATTACHED_TAG)
        txTemplate.execute {
            link(staleMain, main = true)
            link(attachedMain, main = false)
            link(olderSub, main = false)
            link(newerSub, main = false)
            link(firstOfThree, main = false)
            link(secondOfThree, main = false)
            link(latestOfThree, main = false)
            link(solo, main = false)
        }

        txTemplate.execute {
            jdbcTemplate.update(
                """
                DELETE FROM DATABASECHANGELOG
                WHERE FILENAME LIKE '%20261103-remove-duplicate-building-block-process-definition-links%'
                AND AUTHOR = 'Ritense'
                """.trimIndent()
            )
        }

        liquibaseRunner.run()

        assertThat(links()).containsExactlyInAnyOrder(
            attachedMain to true,
            newerSub to false,
            latestOfThree to false,
            solo to false,
        )
    }

    private fun deploy(processKey: String, versionTag: String): String {
        val bpmn = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$processKey" isExecutable="true" camunda:versionTag="$versionTag">
                <bpmn:startEvent id="$processKey-start" />
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
        val deployment = TransactionTemplate(transactionManager).execute {
            repositoryService.createDeployment()
                .addString("$processKey.bpmn", bpmn)
                .deployWithResult()
        }!!
        deploymentIds += deployment.id
        return deployment.deployedProcessDefinitions.single().id
    }

    private fun link(processDefinitionId: String, main: Boolean) {
        jdbcTemplate.update(
            """
            INSERT INTO process_definition_building_block_definition
            (process_definition_id, building_block_definition_key, building_block_definition_version_tag, main)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
            processDefinitionId,
            BUILDING_BLOCK_KEY,
            STORED_BUILDING_BLOCK_VERSION,
            main
        )
    }

    private fun links(): List<Pair<String, Boolean>> = jdbcTemplate.query(
        """
        SELECT process_definition_id, main FROM process_definition_building_block_definition
        WHERE building_block_definition_key = ? AND building_block_definition_version_tag = ?
        """.trimIndent(),
        { rs, _ -> rs.getString("process_definition_id") to rs.getBoolean("main") },
        BUILDING_BLOCK_KEY,
        STORED_BUILDING_BLOCK_VERSION
    )

    private companion object {
        const val BUILDING_BLOCK_KEY = "dedup-links"
        const val BUILDING_BLOCK_VERSION = "12.10.0"
        val STORED_BUILDING_BLOCK_VERSION = SemverConverter.convertToDatabaseColumn(Semver(BUILDING_BLOCK_VERSION))!!
        const val ATTACHED_TAG = "BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"
        const val DETACHED_TAG = "DETACHED:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"
    }
}
