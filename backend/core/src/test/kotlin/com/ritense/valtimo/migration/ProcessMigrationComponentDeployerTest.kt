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

package com.ritense.valtimo.migration

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ProcessMigrationComponentDeployerTest(
    @Mock private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var deployer: ProcessMigrationComponentDeployer

    private val migrationId = CaseDefinitionMigrationId(CaseDefinitionId("bezwaar", "1.0.1"), "plan")

    @BeforeEach
    fun setUp() {
        deployer = ProcessMigrationComponentDeployer(objectMapper, processMigrationConfigurationRepository)
    }

    @Test
    fun `should handle the processMigration component`() {
        assertThat(deployer.componentKey()).isEqualTo("processMigration")
    }

    @Test
    fun `should parse and persist process migration instructions`() {
        val component = objectMapper.readTree(
            """
            [
                {
                    "sourceProcessDefinitionKey": "bezwaar",
                    "targetProcessDefinitionKey": "bezwaar",
                    "mapActivities": { "Activity_A": "Activity_B" },
                    "newProcessVariables": { "age": 31 },
                    "skipCustomListeners": false,
                    "skipIoMappings": true
                }
            ]
            """.trimIndent()
        )

        deployer.deploy(migrationId, component)

        val captor = argumentCaptor<ProcessMigrationConfiguration>()
        verify(processMigrationConfigurationRepository).save(captor.capture())
        val instructions = captor.firstValue.instructions
        assertThat(captor.firstValue.id).isEqualTo(migrationId)
        assertThat(instructions).singleElement()
        val instruction = instructions.single()
        assertThat(instruction.sourceProcessDefinitionKey).isEqualTo("bezwaar")
        assertThat(instruction.targetProcessDefinitionKey).isEqualTo("bezwaar")
        assertThat(instruction.mapActivities).containsEntry("Activity_A", "Activity_B")
        assertThat(instruction.newProcessVariables).containsEntry("age", 31)
        assertThat(instruction.skipIoMappings).isTrue()
    }

    @Test
    fun `should export instructions when present and null when absent or empty`() {
        val instruction = ProcessMigrationInstruction("bezwaar", "bezwaar")
        whenever(processMigrationConfigurationRepository.findById(migrationId))
            .thenReturn(Optional.of(ProcessMigrationConfiguration(migrationId, listOf(instruction))))
        assertThat(deployer.getComponentToExport(migrationId)).isEqualTo(listOf(instruction))

        whenever(processMigrationConfigurationRepository.findById(migrationId))
            .thenReturn(Optional.of(ProcessMigrationConfiguration(migrationId, emptyList())))
        assertThat(deployer.getComponentToExport(migrationId)).isNull()

        whenever(processMigrationConfigurationRepository.findById(migrationId)).thenReturn(Optional.empty())
        assertThat(deployer.getComponentToExport(migrationId)).isNull()
    }
}
