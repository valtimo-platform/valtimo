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
import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.domain.migration.MigrationCondition
import com.ritense.case_.domain.migration.MigrationTriggers
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.exporter.request.MigrationPlanExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import com.ritense.valtimo.contract.case_.migration.MigrationComponentDeployer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class MigrationPlanExporterTest(
    @Mock private val caseDefinitionMigrationRepository: CaseDefinitionMigrationRepository,
    @Mock private val dataMigrationComponentDeployer: MigrationComponentDeployer,
) {

    private val objectMapper = jacksonObjectMapper()
    private lateinit var exporter: MigrationPlanExporter

    private val caseDefinitionId = CaseDefinitionId("bezwaar", "1.2.3")

    @BeforeEach
    fun setUp() {
        exporter = MigrationPlanExporter(
            objectMapper,
            caseDefinitionMigrationRepository,
            listOf(dataMigrationComponentDeployer),
        )
    }

    @Test
    fun `should support MigrationPlanExportRequest`() {
        assertThat(exporter.supports()).isEqualTo(MigrationPlanExportRequest::class.java)
    }

    @Test
    fun `should return empty result when no migration plans exist`() {
        whenever(caseDefinitionMigrationRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
            .thenReturn(emptyList())

        val result = exporter.export(MigrationPlanExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).isEmpty()
    }

    @Test
    fun `should export plan with skeleton and each deployer's component`() {
        val migrationId = CaseDefinitionMigrationId(caseDefinitionId, "aanvraag-indienen")
        whenever(caseDefinitionMigrationRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
            .thenReturn(
                listOf(
                    CaseDefinitionMigration(
                        id = migrationId,
                        title = "Migrate cases",
                        migrationTriggers = MigrationTriggers(triggeredByButton = true),
                        conditions = listOf(
                            MigrationCondition("case:internalStatus", "==", "aanvraag-verwerkt")
                        ),
                    )
                )
            )
        whenever(dataMigrationComponentDeployer.componentKey()).thenReturn("dataMigration")
        whenever(dataMigrationComponentDeployer.getComponentToExport(any()))
            .thenReturn(listOf(DataMigrationPatch(source = "doc:/persoon/voornaam", target = "doc:/contact/voornaam")))

        val result = exporter.export(MigrationPlanExportRequest(caseDefinitionId))

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path)
            .isEqualTo("config/case/bezwaar/1-2-3/case-migration/aanvraag-indienen.case-migration.json")

        val json = objectMapper.readTree(exportFile.content)
        assertThat(json.get("title").asText()).isEqualTo("Migrate cases")
        assertThat(json.get("key").asText()).isEqualTo("aanvraag-indienen")
        assertThat(json.get("migrationTriggers").get("triggeredByButton").asBoolean()).isTrue()
        assertThat(json.get("conditions")[0].get("path").asText()).isEqualTo("case:internalStatus")
        assertThat(json.get("dataMigration")[0].get("source").asText()).isEqualTo("doc:/persoon/voornaam")
    }

    @Test
    fun `should omit components with no data`() {
        val migrationId = CaseDefinitionMigrationId(caseDefinitionId, "empty")
        whenever(caseDefinitionMigrationRepository.findAllByIdCaseDefinitionId(caseDefinitionId))
            .thenReturn(listOf(CaseDefinitionMigration(id = migrationId, title = null)))
        whenever(dataMigrationComponentDeployer.componentKey()).thenReturn("dataMigration")
        whenever(dataMigrationComponentDeployer.getComponentToExport(any())).thenReturn(null)

        val result = exporter.export(MigrationPlanExportRequest(caseDefinitionId))

        val json = objectMapper.readTree(result.exportFiles.first().content)
        assertThat(json.has("dataMigration")).isFalse()
    }
}
