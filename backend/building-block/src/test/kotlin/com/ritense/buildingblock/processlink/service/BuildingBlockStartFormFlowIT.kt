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

package com.ritense.buildingblock.processlink.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.formflow.FormFlowTaskOpenResultProperties
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.domain.definition.FormFlowStep
import com.ritense.formflow.domain.definition.FormFlowStepId
import com.ritense.formflow.domain.definition.configuration.FormFlowStepType
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.domain.instance.FormFlowInstanceId
import com.ritense.formflow.repository.FormFlowDefinitionRepository
import com.ritense.formflow.service.FormFlowService
import com.ritense.formflow.web.rest.FormFlowResource
import com.ritense.formflow.web.rest.dto.FormFlowProcessLinkCreateRequestDto
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.service.ProcessLinkActivityService
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
 * Regression tests for GZAC issue 840: a form flow configured as the start form of a building block's main
 * process must open, and submitting it must start the building block version that is linked to the case.
 *
 * Two defects were fixed:
 *  1. Resolving the start form threw a NullPointerException, because the form flow definition was looked up
 *     through the case-definition link and a building-block-owned process definition has no such link row.
 *  2. Only the process definition key reached the start request, and a key cannot tell versions of a
 *     building-block-owned process apart - every version redeploys the same key.
 */
@Transactional
class BuildingBlockStartFormFlowIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
    private val formFlowDefinitionRepository: FormFlowDefinitionRepository,
    private val processLinkActivityService: ProcessLinkActivityService,
    private val processDocumentService: ProcessDocumentService,
    private val operatonProcessService: OperatonProcessService,
    private val formFlowResource: FormFlowResource,
    private val formFlowService: FormFlowService,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `should open the start form flow of a building block and start the linked version on submit`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val linkedVersionProcessDefinitionId = mainProcessDefinitionIdOf(BUILDING_BLOCK_VERSION)

        deployStartFormFlow(buildingBlockDefinitionId)
        linkFormFlowToMainProcessStartEvent(buildingBlockDefinitionId, linkedVersionProcessDefinitionId)
        linkBuildingBlockToCase()
        val caseDocumentId = startCase()

        deployNewerBuildingBlockVersionOfMainProcess()

        // Defect 1: this used to throw a NullPointerException, so no start form opened at all.
        val startEventResult = runWithoutAuthorization {
            processLinkActivityService.getStartEventObject(
                linkedVersionProcessDefinitionId,
                caseDocumentId,
                null
            )
        }
        assertThat(startEventResult).isNotNull
        assertThat(startEventResult!!.type).isEqualTo("form-flow")
        assertThat(startEventResult.properties).isInstanceOf(FormFlowTaskOpenResultProperties::class.java)

        val formFlowInstance = formFlowService.getInstanceById(
            FormFlowInstanceId.existingId(
                (startEventResult.properties as FormFlowTaskOpenResultProperties).formFlowInstanceId
            )
        )
        // Defect 2: the exact version has to travel with the form flow instance - the key cannot identify it.
        assertThat(formFlowInstance.getAdditionalProperties())
            .containsEntry("processDefinitionId", linkedVersionProcessDefinitionId)
            .containsEntry("processDefinitionKey", MAIN_PROCESS_KEY)
            .containsEntry("documentId", caseDocumentId)

        runWithoutAuthorization {
            formFlowResource.completeStep(
                formFlowInstance.id.id.toString(),
                formFlowInstance.currentFormFlowStepInstanceId!!.id.toString(),
                objectMapper.readTree("""{"straatnaam":"Hoofdstraat"}""")
            )
        }

        // The listener derives the building block version from the started definition's version tag, so
        // starting the wrong version leaves the case without a building block instance altogether.
        val instances = buildingBlockInstanceRepository.findAll().filter { it.caseDocumentId == caseDocumentId }
        assertThat(instances).hasSize(1)
        assertThat(instances.first().definition.id).isEqualTo(buildingBlockDefinitionId)

        // The main process waits on a message, so its instance is still running and assertable. Its business
        // key is the building block document by now - the start event listener re-pointed it - so the instance
        // is looked up through the building block instance instead.
        val startedInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceId(instances.first().processInstanceId)
            .singleResult()
            ?: error("Building block main process is not running for case document $caseDocumentId")
        assertThat(startedInstance.processDefinitionId).isEqualTo(linkedVersionProcessDefinitionId)
    }

    /**
     * Saves the form flow definition straight through the repository. The `bezwaar` fixture is final, so the
     * importer's "final building block" write check would reject it.
     */
    private fun deployStartFormFlow(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        val step = FormFlowStep(
            id = FormFlowStepId(FORM_FLOW_STEP_KEY),
            onComplete = listOf("\${valtimoFormFlow.startSupportingProcess(instance.id, {'doc:/straatnaam':'/straatnaam'})}"),
            type = FormFlowStepType("form", FormStepTypeProperties("bb-form"))
        )
        formFlowDefinitionRepository.save(
            FormFlowDefinition(
                FormFlowDefinitionId.existingId(FORM_FLOW_KEY, buildingBlockDefinitionId),
                FORM_FLOW_STEP_KEY,
                setOf(step)
            )
        )
    }

    private fun linkFormFlowToMainProcessStartEvent(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        mainProcessDefinitionId: String
    ) {
        processLinkService.createProcessLink(
            FormFlowProcessLinkCreateRequestDto(
                mainProcessDefinitionId,
                START_EVENT_ID,
                ActivityTypeWithEventName.START_EVENT_START,
                FORM_FLOW_KEY
            ),
            buildingBlockDefinitionId
        )
    }

    private fun linkBuildingBlockToCase() {
        runWithoutAuthorization {
            caseDefinitionBuildingBlockLinkService.createLink(
                CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                CreateCaseDefinitionBuildingBlockLinkDto(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
            )
        }
    }

    /**
     * Resolves the process definition of a building block version by its version tag rather than through the
     * `main` link, so the test does not depend on state other integration tests may have committed.
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

    /**
     * Redeploys the building block's main process under a newer building block version tag - the same thing
     * creating a draft version does - so both versions share one process definition key. That ambiguity is
     * what made the wrong version start.
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

        assertThat(mainProcessDefinitionIdOf(DRAFT_VERSION))
            .isNotEqualTo(mainProcessDefinitionIdOf(BUILDING_BLOCK_VERSION))
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
        const val DRAFT_VERSION = "8.4.0"
        const val CASE_DEFINITION_KEY = "bb-case"
        const val CASE_DEFINITION_VERSION = "1.0.0"
        const val CASE_MAIN_PROCESS_KEY = "bb-case-plain-main"
        const val MAIN_PROCESS_KEY = "building-block-process"
        const val START_EVENT_ID = "StartEvent_1"
        const val FORM_FLOW_KEY = "bb-start-form-flow"
        const val FORM_FLOW_STEP_KEY = "step1"
        const val MAIN_PROCESS_RESOURCE =
            "config/building-block/bezwaar/1-0-0/bpmn/building-block-process.bpmn"
    }
}
