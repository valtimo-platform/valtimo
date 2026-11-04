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
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.importer.ImportContext
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersionTag
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
    private val processDefinitionLinkExporter: BuildingBlockProcessDefinitionLinkExporter,
    private val processDefinitionExporter: BuildingBlockProcessDefinitionExporter,
) : BaseIntegrationTest() {

    @Test
    fun `should list the process once after importing the same building block twice`() {
        importBuildingBlock("Building block process")
        val firstProcessDefinitionId = linkedProcessDefinitionIds().single()

        importBuildingBlock("Building block process, edited")

        // Guard: the second import really deployed another version, which is what used to add a second row.
        assertThat(linkedProcessDefinitionIds()).doesNotContain(firstProcessDefinitionId)
        assertThat(linkedKeysAndMain()).containsExactly(PROCESS_KEY to true)
    }

    @Test
    fun `should link every process of a BPMN file with more than one process`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(twoProcessBpmn("Second, edited"), mainProcessKey = FIRST_PROCESS_KEY)

        assertThat(linkedKeysAndMain())
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY to true, SECOND_PROCESS_KEY to false)
    }

    @Test
    fun `should link every process of a BPMN file with more than one process in a new version`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)

        val processDefinitions = finalizeAndListDraftProcesses()

        assertThat(processDefinitions.map { it.key to it.main })
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY to true, SECOND_PROCESS_KEY to false)
        assertThat(processDefinitions.map { it.versionTag }).containsOnly("BB:$BUILDING_BLOCK_KEY:$DRAFT_VERSION")
    }

    @Test
    fun `should detach every process of a BPMN file with more than one process`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(twoProcessBpmn("Second, edited"), mainProcessKey = FIRST_PROCESS_KEY)

        assertThat(attachedProcessDefinitions().map { it.key })
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY, SECOND_PROCESS_KEY)
    }

    @Test
    fun `should export a BPMN file with more than one process once`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)

        assertThat(exportFiles().map { it.path }.distinct())
            .containsExactly("config/building-block/$BUILDING_BLOCK_KEY/7-3-1/bpmn/$FIRST_PROCESS_KEY.bpmn")
    }

    // The process name varies per import so the engine deploys a new version, as two differing exports do.
    private fun importBuildingBlock(processName: String) {
        val bpmn = resource("config/building-block/bezwaar/1-0-0/bpmn/$PROCESS_KEY.bpmn")
            .decodeToString()
            .replace("name=\"Building block process\"", "name=\"$processName\"")
            .toByteArray()

        importBuildingBlock(bpmn, PROCESS_KEY)
    }

    private fun importBuildingBlock(bpmn: ByteArray, mainProcessKey: String) {
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
                        """{"processDefinitionKey":"$mainProcessKey"}""".toByteArray(),
                        buildingBlockDefinitionId = buildingBlockDefinitionId()
                    )
                )
            }
        }
    }

    private fun finalizeAndListDraftProcesses() = runWithoutAuthorization {
        buildingBlockManagementService.finalize(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        buildingBlockManagementService.createDraft(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION, DRAFT_VERSION)
        buildingBlockProcessService.getProcessDefinitionsForBuildingBlock(BUILDING_BLOCK_KEY, DRAFT_VERSION)
    }

    private fun attachedProcessDefinitions() = runWithoutAuthorization {
        operatonRepositoryService.findProcessDefinitions(byVersionTag("BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"))
    }

    private fun exportFiles() = runWithoutAuthorization {
        processDefinitionLinkExporter
            .export(BuildingBlockDocumentDefinitionExportRequest("document", buildingBlockDefinitionId()))
            .relatedRequests
            .filterIsInstance<BuildingBlockProcessDefinitionExportRequest>()
            .flatMap { processDefinitionExporter.export(it).exportFiles }
    }

    private fun linkedKeysAndMain() = runWithoutAuthorization {
        buildingBlockProcessService
            .getProcessDefinitionsForBuildingBlock(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
            .map { it.key to it.main }
    }

    private fun twoProcessBpmn(secondProcessName: String) = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="$FIRST_PROCESS_KEY" name="First" isExecutable="true">
            <bpmn:startEvent id="FirstStart" />
          </bpmn:process>
          <bpmn:process id="$SECOND_PROCESS_KEY" name="$secondProcessName" isExecutable="true">
            <bpmn:startEvent id="SecondStart" />
          </bpmn:process>
        </bpmn:definitions>
    """.trimIndent().toByteArray()

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
        const val DRAFT_VERSION = "7.3.2"
        const val PROCESS_KEY = "building-block-process"
        const val FIRST_PROCESS_KEY = "import-dup-check-first"
        const val SECOND_PROCESS_KEY = "import-dup-check-second"
    }
}
