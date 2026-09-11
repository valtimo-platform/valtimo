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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.importer.ImportContext
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional

@Transactional
class BuildingBlockImportProcessDefinitionLinkIT @Autowired constructor(
    private val buildingBlockDefinitionImporter: BuildingBlockDefinitionImporter,
    private val processDefinitionImporter: ProcessDefinitionBuildingBlockDefinitionImporter,
    private val mainProcessDefinitionImporter: BuildingBlockDefinitionMainProcessDefinitionImporter,
    private val linkRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
) : BaseIntegrationTest() {

    @Test
    fun `should list the process once after importing the same building block twice`() {
        importBuildingBlock("Building block process")
        val firstProcessDefinitionId = linkedProcessDefinitionIds().single()

        importBuildingBlock("Building block process, edited")

        // Guard: the second import really deployed another version, which is what used to add a second row.
        assertThat(linkedProcessDefinitionIds()).doesNotContain(firstProcessDefinitionId)

        val processDefinitions = runWithoutAuthorization {
            buildingBlockProcessService.getProcessDefinitionsForBuildingBlock(
                BUILDING_BLOCK_KEY,
                BUILDING_BLOCK_VERSION
            )
        }

        assertThat(processDefinitions).hasSize(1)
        assertThat(processDefinitions.single().key).isEqualTo(PROCESS_KEY)
        assertThat(processDefinitions.single().main).isTrue()
    }

    // The process name varies per import so the engine deploys a new version, as two differing exports do.
    private fun importBuildingBlock(processName: String) {
        val bpmn = resource("config/building-block/bezwaar/1-0-0/bpmn/$PROCESS_KEY.bpmn")
            .decodeToString()
            .replace("name=\"Building block process\"", "name=\"$processName\"")
            .toByteArray()

        ImportContext.runImporter {
            runWithoutAuthorization {
                buildingBlockDefinitionImporter.import(
                    ImportRequest(
                        "/building-block/definition/$BUILDING_BLOCK_KEY.building-block-definition.json",
                        definitionJson()
                    )
                )
                processDefinitionImporter.import(
                    ImportRequest(
                        "/bpmn/$PROCESS_KEY.bpmn",
                        bpmn,
                        buildingBlockDefinitionId = buildingBlockDefinitionId()
                    )
                )
                mainProcessDefinitionImporter.import(
                    ImportRequest(
                        "/building-block/building-block-definition-main-process-definition.json",
                        """{"processDefinitionKey":"$PROCESS_KEY"}""".toByteArray(),
                        buildingBlockDefinitionId = buildingBlockDefinitionId()
                    )
                )
            }
        }
    }

    private fun linkedProcessDefinitionIds() = linkRepository
        .findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId())
        .map { it.id.processDefinitionId.id }

    private fun definitionJson() = """
        {"key":"$BUILDING_BLOCK_KEY","name":"Duplicate check","versionTag":"$BUILDING_BLOCK_VERSION","final":false}
    """.trimIndent().toByteArray()

    private fun buildingBlockDefinitionId() =
        BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

    private fun resource(path: String) =
        requireNotNull(javaClass.classLoader.getResourceAsStream(path)) { "Missing test resource $path" }
            .use { it.readBytes() }

    private companion object {
        // Deliberately distinctive so no fixture or other integration test can have created it.
        const val BUILDING_BLOCK_KEY = "import-dup-check"
        const val BUILDING_BLOCK_VERSION = "7.3.1"
        const val PROCESS_KEY = "building-block-process"
    }
}
