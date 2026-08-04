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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.document.domain.impl.request.ModifyDocumentRequest
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.domain.impl.request.ModifyDocumentAndStartProcessRequest
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayInputStream
import java.util.UUID

/**
 * Regression tests for GZAC issue 819: a building block version that is linked to a case as an action
 * must be started at that exact version, even when a newer draft version of the same building block has
 * redeployed the same process definition key under a higher engine version.
 */
@Transactional
class BuildingBlockStartableItemVersionIT @Autowired constructor(
    private val processDocumentService: ProcessDocumentService,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val operatonProcessService: OperatonProcessService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `should start the linked building block version and not the latest one`() {
        val linkedVersionProcessDefinitionId = mainProcessDefinitionIdOf(BUILDING_BLOCK_VERSION)
        linkBuildingBlockToCase()
        val caseDocumentId = startCase()

        deployNewerBuildingBlockVersionOfMainProcess()

        // Guard: both versions share one process key, so a lookup by key alone is ambiguous.
        assertThat(deployedVersionTagsOfMainProcess())
            .contains("BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION", "BB:$BUILDING_BLOCK_KEY:$DRAFT_VERSION")

        val result = runWithoutAuthorization {
            processDocumentService.modifyDocumentAndStartProcess(
                ModifyDocumentAndStartProcessRequest(
                    MAIN_PROCESS_KEY,
                    ModifyDocumentRequest(caseDocumentId.toString(), objectMapper.createObjectNode())
                ).withProcessDefinitionId(linkedVersionProcessDefinitionId)
            )
        }

        assertThat(result.errors()).isEmpty()
        val processInstanceId = result.resultingProcessInstanceId().orElseThrow().toString()
        val startedDefinitionId = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            .processDefinitionId
        assertThat(startedDefinitionId).isEqualTo(linkedVersionProcessDefinitionId)

        // The listener derives the building block version from the started definition's version tag, so
        // starting the wrong version leaves the case without a building block instance altogether.
        val instances = buildingBlockInstancesOf(caseDocumentId)
        assertThat(instances).hasSize(1)
        assertThat(instances.first().definition.id)
            .isEqualTo(BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION))
    }

    @Test
    fun `should fail instead of guessing a version when only the process definition key is given`() {
        linkBuildingBlockToCase()
        val caseDocumentId = startCase()
        deployNewerBuildingBlockVersionOfMainProcess()

        val result = runWithoutAuthorization {
            processDocumentService.modifyDocumentAndStartProcess(
                ModifyDocumentAndStartProcessRequest(
                    MAIN_PROCESS_KEY,
                    ModifyDocumentRequest(caseDocumentId.toString(), objectMapper.createObjectNode())
                )
            )
        }

        assertThat(result.errors()).isNotEmpty()
        assertThat(buildingBlockInstancesOf(caseDocumentId)).isEmpty()
    }

    @Test
    fun `should resolve a standalone building block start by its building block blueprint`() {
        val linkedVersionProcessDefinitionId = mainProcessDefinitionIdOf(BUILDING_BLOCK_VERSION)
        deployNewerBuildingBlockVersionOfMainProcess()

        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    MAIN_PROCESS_KEY,
                    NewDocumentRequest(
                        BUILDING_BLOCK_KEY,
                        null,
                        null,
                        BUILDING_BLOCK_KEY,
                        BUILDING_BLOCK_VERSION,
                        objectMapper.createObjectNode()
                    )
                )
            )
        }

        assertThat(result.errors()).isEmpty()
        val startedDefinitionId = runtimeService.createProcessInstanceQuery()
            .processInstanceId(result.resultingProcessInstanceId().orElseThrow().toString())
            .singleResult()
            .processDefinitionId
        assertThat(startedDefinitionId).isEqualTo(linkedVersionProcessDefinitionId)
    }

    /**
     * Resolves the process definition of a building block version by its version tag rather than through
     * the `main` link, so the test does not depend on state other integration tests may have committed.
     */
    private fun mainProcessDefinitionIdOf(versionTag: String): String {
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .versionTag("BB:$BUILDING_BLOCK_KEY:$versionTag")
            .orderByProcessDefinitionVersion()
            .desc()
            .list()
            .firstOrNull()
            ?.id
            ?: throw IllegalStateException("No process definition for building block $BUILDING_BLOCK_KEY:$versionTag")
    }

    private fun buildingBlockInstancesOf(caseDocumentId: UUID) =
        buildingBlockInstanceRepository.findAll().filter { it.caseDocumentId == caseDocumentId }

    private fun linkBuildingBlockToCase() {
        runWithoutAuthorization {
            caseDefinitionBuildingBlockLinkService.createLink(
                CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                CreateCaseDefinitionBuildingBlockLinkDto(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
            )
        }
    }

    /**
     * Redeploys the building block's main process under a newer building block version tag - the same
     * thing creating a draft version does (see BuildingBlockDefinitionEventListener.copyProcessDefinitions),
     * but done directly so the test does not depend on the state of the shared `bezwaar` fixture.
     */
    private fun deployNewerBuildingBlockVersionOfMainProcess() {
        val bpmn = requireNotNull(javaClass.classLoader.getResourceAsStream(MAIN_PROCESS_RESOURCE)) {
            "Missing test resource $MAIN_PROCESS_RESOURCE"
        }.use { it.readBytes() }

        runWithoutAuthorization {
            operatonProcessService.deploy(
                BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, DRAFT_VERSION),
                "$MAIN_PROCESS_KEY.bpmn",
                ByteArrayInputStream(bpmn),
                true,
                true
            )
        }

        // Both versions now share one process definition key, which is exactly the ambiguity that made the
        // wrong version start.
        assertThat(mainProcessDefinitionIdOf(DRAFT_VERSION))
            .isNotEqualTo(mainProcessDefinitionIdOf(BUILDING_BLOCK_VERSION))
    }

    private fun deployedVersionTagsOfMainProcess(): List<String?> {
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .list()
            .map { it.versionTag }
    }

    private fun startCase(): UUID {
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    CASE_MAIN_PROCESS_KEY,
                    NewDocumentRequest(
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_VERSION,
                        objectMapper.createObjectNode()
                    )
                )
            )
        }
        return result.resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created: ${result.errors()}") }
            .id()
            .id
    }

    private companion object {
        const val BUILDING_BLOCK_KEY = "bezwaar"
        const val BUILDING_BLOCK_VERSION = "1.0.0"
        // Deliberately distinctive so other integration tests in this module cannot have created it.
        const val DRAFT_VERSION = "8.1.9"
        const val CASE_DEFINITION_KEY = "bb-case"
        const val CASE_DEFINITION_VERSION = "1.0.0"
        const val CASE_MAIN_PROCESS_KEY = "bb-case-plain-main"
        const val MAIN_PROCESS_KEY = "building-block-process"
        const val MAIN_PROCESS_RESOURCE =
            "config/building-block/bezwaar/1-0-0/bpmn/building-block-process.bpmn"
    }
}
