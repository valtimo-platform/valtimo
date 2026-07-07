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

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case_.domain.migration.DataMigrationConfiguration
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.repository.DataMigrationConfigurationRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
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
class DataMigrationComponentDeployerTest(
    @Mock private val dataMigrationConfigurationRepository: DataMigrationConfigurationRepository,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var deployer: DataMigrationComponentDeployer

    private val migrationId = CaseDefinitionMigrationId(CaseDefinitionId("bezwaar", "1.0.1"), "plan")

    @BeforeEach
    fun setUp() {
        deployer = DataMigrationComponentDeployer(objectMapper, dataMigrationConfigurationRepository)
    }

    @Test
    fun `should handle the dataMigration component`() {
        assertThat(deployer.componentKey()).isEqualTo("dataMigration")
    }

    @Test
    fun `should parse and persist copy and set patches`() {
        val component = objectMapper.readTree(
            """
            [
                { "source": "doc:/persoon/voornaam", "target": "doc:/contact/voornaam" },
                { "value": "Henk", "target": "doc:/persoon/voornaam", "targetType": "string" }
            ]
            """.trimIndent()
        )

        deployer.deploy(migrationId, component)

        val captor = argumentCaptor<DataMigrationConfiguration>()
        verify(dataMigrationConfigurationRepository).save(captor.capture())
        val patches = captor.firstValue.patches
        assertThat(captor.firstValue.id).isEqualTo(migrationId)
        assertThat(patches).hasSize(2)
        assertThat(patches[0].source).isEqualTo("doc:/persoon/voornaam")
        assertThat(patches[0].target).isEqualTo("doc:/contact/voornaam")
        assertThat(patches[1].value).isEqualTo("Henk")
        assertThat(patches[1].targetType).isEqualTo("string")
    }

    @Test
    fun `should export patches when present and null when absent or empty`() {
        val patch = DataMigrationPatch(source = "doc:/a", target = "doc:/b")
        whenever(dataMigrationConfigurationRepository.findById(migrationId))
            .thenReturn(Optional.of(DataMigrationConfiguration(migrationId, listOf(patch))))

        assertThat(deployer.getComponentToExport(migrationId)).isEqualTo(listOf(patch))

        whenever(dataMigrationConfigurationRepository.findById(migrationId))
            .thenReturn(Optional.of(DataMigrationConfiguration(migrationId, emptyList())))
        assertThat(deployer.getComponentToExport(migrationId)).isNull()

        whenever(dataMigrationConfigurationRepository.findById(migrationId)).thenReturn(Optional.empty())
        assertThat(deployer.getComponentToExport(migrationId)).isNull()
    }
}
