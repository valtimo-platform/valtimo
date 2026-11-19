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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.importer.ImportService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

@Transactional
class BuildingBlockCaseImportIT @Autowired constructor(
    private val importService: ImportService,
) : BaseIntegrationTest() {

    @Test
    fun `case import skips a building block that already exists as final`() {
        val id = BuildingBlockDefinitionId("bezwaar", "1.0.0")
        assertThat(buildingBlockDefinitionRepository.findByIdOrNull(id)?.final).isTrue()

        val caseDefinitionId = importService.import(ByteArrayInputStream(caseExportWithFinalBuildingBlock()), emptyList())

        assertThat(caseDefinitionId).isEqualTo(CaseDefinitionId("imported-case", "1.0.0"))
        assertThat(buildingBlockDefinitionRepository.findByIdOrNull(id)?.final).isTrue()
    }

    private fun caseExportWithFinalBuildingBlock(): ByteArray {
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(
                ZipEntry("config/building-block/bezwaar/1-0-0/building-block/definition/bezwaar.building-block-definition.json")
            )
            zip.write(
                """
                {
                    "key": "bezwaar",
                    "name": "Bezwaar",
                    "versionTag": "1.0.0",
                    "final": true
                }
                """.trimIndent().toByteArray()
            )
            zip.closeEntry()
            zip.putNextEntry(
                ZipEntry("config/case/imported-case/1-0-0/case/definition/imported-case.case-definition.json")
            )
            zip.write(
                """
                {
                    "key": "imported-case",
                    "name": "Imported case",
                    "versionTag": "1.0.0",
                    "final": false,
                    "canHaveAssignee": true,
                    "autoAssignTasks": false
                }
                """.trimIndent().toByteArray()
            )
            zip.closeEntry()
        }
        return output.toByteArray()
    }
}
