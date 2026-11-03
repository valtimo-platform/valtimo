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
    fun `changeset should keep one link per process on its latest version, keep the main flag and link every process of a file`() {
        val txTemplate = TransactionTemplate(transactionManager)
        txTemplate.execute {
            jdbcTemplate.update(
                """
                INSERT INTO building_block_definition
                (building_block_definition_key, building_block_definition_version_tag, name, is_final)
                VALUES (?, ?, 'Duplicate links', false)
                """.trimIndent(),
                BUILDING_BLOCK_KEY,
                BUILDING_BLOCK_VERSION
            )
        }
        val staleMain = deploy("dedup-main", DETACHED_TAG)
        val attachedMain = deploy("dedup-main", ATTACHED_TAG)
        val olderDetachedSub = deploy("dedup-sub", DETACHED_TAG)
        val newerDetachedSub = deploy("dedup-sub", DETACHED_TAG)
        val attachedOlder = deploy("dedup-attached", ATTACHED_TAG)
        val detachedNewer = deploy("dedup-attached", DETACHED_TAG)
        val solo = deploy("dedup-solo", ATTACHED_TAG)
        val supersededOnly = deploy("dedup-superseded-only", DETACHED_TAG)
        val attachedUnlinked = deploy("dedup-superseded-only", ATTACHED_TAG)
        val attachedFile = deployFile(ATTACHED_TAG, "dedup-file-first", "dedup-file-second")
        val detachedFile = deployFile(DETACHED_TAG, "dedup-old-file-first", "dedup-old-file-second")
        val changedFileV1 = deployFile(ATTACHED_TAG, "dedup-changed-first", "dedup-changed-main", "dedup-changed-third")
        val changedFileV2 = deployFile(ATTACHED_TAG, "dedup-changed-first", "dedup-changed-main", "dedup-changed-third")
        txTemplate.execute {
            link(staleMain, main = true)
            link(attachedMain, main = false)
            link(olderDetachedSub, main = false)
            link(newerDetachedSub, main = false)
            link(attachedOlder, main = false)
            link(detachedNewer, main = false)
            link(solo, main = false)
            link(supersededOnly, main = false)
            link(attachedFile.getValue("dedup-file-first"), main = false)
            link(detachedFile.getValue("dedup-old-file-first"), main = false)
            link(changedFileV2.getValue("dedup-changed-first"), main = false)
            link(changedFileV1.getValue("dedup-changed-main"), main = true)
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
            newerDetachedSub to false,
            attachedOlder to false,
            solo to false,
            attachedUnlinked to false,
            attachedFile.getValue("dedup-file-first") to false,
            attachedFile.getValue("dedup-file-second") to false,
            detachedFile.getValue("dedup-old-file-first") to false,
            changedFileV2.getValue("dedup-changed-first") to false,
            changedFileV2.getValue("dedup-changed-main") to true,
            changedFileV2.getValue("dedup-changed-third") to false,
        )
    }

    private fun deploy(processKey: String, versionTag: String): String =
        deployFile(versionTag, processKey).getValue(processKey)

    private fun deployFile(versionTag: String, vararg processKeys: String): Map<String, String> {
        val processes = processKeys.joinToString("\n") { processKey ->
            """
              <bpmn:process id="$processKey" isExecutable="true" camunda:versionTag="$versionTag">
                <bpmn:startEvent id="$processKey-start" />
              </bpmn:process>
            """
        }
        val bpmn = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
            $processes
            </bpmn:definitions>
        """.trimIndent()
        val deployment = TransactionTemplate(transactionManager).execute {
            repositoryService.createDeployment()
                .addString("${processKeys.first()}.bpmn", bpmn)
                .deployWithResult()
        }!!
        deploymentIds += deployment.id
        return deployment.deployedProcessDefinitions.associate { it.key to it.id }
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
            BUILDING_BLOCK_VERSION,
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
        BUILDING_BLOCK_VERSION
    )

    private companion object {
        const val BUILDING_BLOCK_KEY = "dedup-links"
        const val BUILDING_BLOCK_VERSION = "1.0.0"
        const val ATTACHED_TAG = "BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"
        const val DETACHED_TAG = "DETACHED:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"
    }
}
