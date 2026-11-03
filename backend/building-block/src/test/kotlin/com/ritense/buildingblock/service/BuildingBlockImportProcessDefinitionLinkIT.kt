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
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.importer.ImportContext
import com.ritense.importer.ImportRequest
import com.ritense.processdocument.domain.ProcessDefinitionId
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
    fun `should not link a removed process of a BPMN file with more than one process in a new version`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)

        runWithoutAuthorization {
            val second = buildingBlockProcessService
                .getProcessDefinitionsForBuildingBlock(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
                .single { it.key == SECOND_PROCESS_KEY }
            buildingBlockProcessService.deleteProcessDefinitionForBuildingBlock(
                BUILDING_BLOCK_KEY,
                BUILDING_BLOCK_VERSION,
                second.id
            )
        }

        val processDefinitions = finalizeAndListDraftProcesses()

        assertThat(processDefinitions.map { it.key to it.main }).containsExactly(FIRST_PROCESS_KEY to true)
    }

    @Test
    fun `should copy a single main link to a new version when a stale link to an older version exists`() {
        importBuildingBlock("Building block process")
        val staleProcessDefinitionId = linkedProcessDefinitionIds().single()
        importBuildingBlock("Building block process, edited")
        linkAsMain(staleProcessDefinitionId)

        val processDefinitions = finalizeAndListDraftProcesses()

        assertThat(processDefinitions.map { it.key to it.main }).containsExactly(PROCESS_KEY to true)
        assertThat(processDefinitions.single().name).isEqualTo("Building block process, edited")
    }

    @Test
    fun `should copy the attached version to a new version when only a superseded version is linked`() {
        importBuildingBlock("Building block process")
        val staleProcessDefinitionId = linkedProcessDefinitionIds().single()
        importBuildingBlock("Building block process, edited")
        linkRepository.deleteAll(linkRepository.findAllByIdBuildingBlockDefinitionId(buildingBlockDefinitionId()))
        linkAsMain(staleProcessDefinitionId)

        val processDefinitions = finalizeAndListDraftProcesses()

        assertThat(processDefinitions.map { it.key to it.main }).containsExactly(PROCESS_KEY to true)
        assertThat(processDefinitions.single().name).isEqualTo("Building block process, edited")
    }

    @Test
    fun `should detach every process of a BPMN file with more than one process`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(twoProcessBpmn("Second, edited"), mainProcessKey = FIRST_PROCESS_KEY)

        assertThat(attachedProcessDefinitions().map { it.key })
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY, SECOND_PROCESS_KEY)
    }

    @Test
    fun `should unlink and detach a process removed from a BPMN file with more than one process`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(firstProcessOnlyBpmn("First, edited"), mainProcessKey = FIRST_PROCESS_KEY)

        assertThat(linkedKeysAndMain()).containsExactly(FIRST_PROCESS_KEY to true)
        assertThat(attachedProcessDefinitions().map { it.key }).containsExactly(FIRST_PROCESS_KEY)
        assertThat(finalizeAndListDraftProcesses().map { Triple(it.key, it.name, it.main) })
            .containsExactly(Triple(FIRST_PROCESS_KEY, "First, edited", true))
    }

    @Test
    fun `should keep a process linked when its sibling moves to another BPMN file`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(secondProcessOnlyBpmn(), mainProcessKey = FIRST_PROCESS_KEY, fileName = "moved")

        assertThat(linkedKeysAndMain())
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY to true, SECOND_PROCESS_KEY to false)
        assertThat(attachedProcessDefinitions().map { it.key to it.resourceName })
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY to "$PROCESS_KEY.bpmn", SECOND_PROCESS_KEY to "moved.bpmn")
    }

    @Test
    fun `should keep processes linked from files with the same name in different folders`() {
        importBuildingBlock(firstProcessOnlyBpmn("First"), mainProcessKey = FIRST_PROCESS_KEY, fileName = "a/shared")
        importBuildingBlock(secondProcessOnlyBpmn(), mainProcessKey = SECOND_PROCESS_KEY, fileName = "b/shared")

        assertThat(linkedKeysAndMain())
            .containsExactlyInAnyOrder(FIRST_PROCESS_KEY to false, SECOND_PROCESS_KEY to true)
    }

    @Test
    fun `should keep a process linked when its unchanged file is renamed and the old name is reused`() {
        importBuildingBlock(secondProcessOnlyBpmn(), mainProcessKey = SECOND_PROCESS_KEY, fileName = "f2")
        importBuildingBlock(firstProcessOnlyBpmn("First"), mainProcessKey = SECOND_PROCESS_KEY, fileName = "f1")
        importBuildingBlock(
            singleProcessBpmn(THIRD_PROCESS_KEY, "Third"),
            mainProcessKey = SECOND_PROCESS_KEY,
            fileName = "f1"
        )
        importBuildingBlock(firstProcessOnlyBpmn("First"), mainProcessKey = SECOND_PROCESS_KEY, fileName = "renamed")

        assertThat(linkedKeysAndMain()).containsExactlyInAnyOrder(
            FIRST_PROCESS_KEY to false,
            SECOND_PROCESS_KEY to true,
            THIRD_PROCESS_KEY to false
        )
    }

    @Test
    fun `should export only the current file when a renamed BPMN file drops a process`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY, fileName = "f")
        importBuildingBlock(firstProcessOnlyBpmn("First, edited"), mainProcessKey = FIRST_PROCESS_KEY, fileName = "g")

        val exportFiles = exportFiles()

        assertThat(exportFiles.map { it.path }.distinct())
            .containsExactly("config/building-block/$BUILDING_BLOCK_KEY/7-3-1/bpmn/$FIRST_PROCESS_KEY.bpmn")
        assertThat(exportFiles.map { it.content.decodeToString() })
            .allSatisfy { assertThat(it).contains("name=\"First, edited\"").doesNotContain(SECOND_PROCESS_KEY) }
    }

    @Test
    fun `should export the main process when its sibling moved to another BPMN file`() {
        importBuildingBlock(twoProcessBpmn("Second"), mainProcessKey = FIRST_PROCESS_KEY)
        importBuildingBlock(secondProcessOnlyBpmn(), mainProcessKey = FIRST_PROCESS_KEY, fileName = "moved")

        assertThat(exportFiles().map { it.path }.distinct()).containsExactlyInAnyOrder(
            "config/building-block/$BUILDING_BLOCK_KEY/7-3-1/bpmn/$FIRST_PROCESS_KEY.bpmn",
            "config/building-block/$BUILDING_BLOCK_KEY/7-3-1/bpmn/$SECOND_PROCESS_KEY.bpmn"
        )
    }

    private fun importBuildingBlock(processName: String) {
        val bpmn = resource("config/building-block/bezwaar/1-0-0/bpmn/$PROCESS_KEY.bpmn")
            .decodeToString()
            .replace("name=\"Building block process\"", "name=\"$processName\"")
            .toByteArray()

        importBuildingBlock(bpmn, PROCESS_KEY)
    }

    private fun importBuildingBlock(bpmn: ByteArray, mainProcessKey: String, fileName: String = PROCESS_KEY) {
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
                        "/bpmn/$fileName.bpmn",
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

    private fun linkAsMain(processDefinitionId: String) {
        linkRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                ProcessDefinitionBuildingBlockDefinitionId(
                    ProcessDefinitionId.of(processDefinitionId),
                    buildingBlockDefinitionId()
                ),
                true
            )
        )
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

    private fun secondProcessOnlyBpmn() = singleProcessBpmn(SECOND_PROCESS_KEY, "Second, moved")

    private fun firstProcessOnlyBpmn(firstProcessName: String) = singleProcessBpmn(FIRST_PROCESS_KEY, firstProcessName)

    private fun singleProcessBpmn(processKey: String, processName: String) = """
        <?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
          <bpmn:process id="$processKey" name="$processName" isExecutable="true">
            <bpmn:startEvent id="${processKey}Start" />
          </bpmn:process>
        </bpmn:definitions>
    """.trimIndent().toByteArray()

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
        const val BUILDING_BLOCK_KEY = "import-dup-check"
        const val BUILDING_BLOCK_VERSION = "7.3.1"
        const val DRAFT_VERSION = "7.3.2"
        const val PROCESS_KEY = "building-block-process"
        const val FIRST_PROCESS_KEY = "import-dup-check-first"
        const val SECOND_PROCESS_KEY = "import-dup-check-second"
        const val THIRD_PROCESS_KEY = "import-dup-check-third"
    }
}
