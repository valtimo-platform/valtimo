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

package com.ritense.processlink.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.domain.ProcessDocumentDefinitionRequest
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.event.ProcessLinksDeployedEvent
import com.ritense.processlink.validation.ProcessDefinitionValidationError
import com.ritense.processlink.validation.ProcessDefinitionValidationException
import com.ritense.processlink.validation.ProcessDefinitionValidationOptions
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.operaton.bpm.engine.ParseException
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayInputStream
import kotlin.reflect.full.memberProperties
import kotlin.reflect.full.primaryConstructor

@Transactional
class ProcessDeploymentService(
    private val operatonProcessService: OperatonProcessService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val processLinkService: ProcessLinkService,
    private val processDefinitionValidator: ProcessDefinitionValidator,
    private val repositoryService: RepositoryService,
    private val applicationEventPublisher: ApplicationEventPublisher,
) {
    fun findExistingProcessDefinitionForCaseDefinition(
        caseDefinitionId: CaseDefinitionId,
        bpmn: MultipartFile?,
        processDefinitionId: String?
    ): OperatonProcessDefinition? {
        return runWithoutAuthorization {
            val model = if (bpmn != null) {
                Bpmn.readModelFromStream(ByteArrayInputStream(bpmn.bytes))
            } else {
                operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(processDefinitionId!!)
            }
            operatonProcessService.getExistingProcessForFile(caseDefinitionId, model)
        }
    }

    fun findExistingUnlinkedProcessDefinition(
        bpmn: MultipartFile?,
        processDefinitionId: String?
    ): OperatonProcessDefinition? {
        return runWithoutAuthorization {
            val model = if (bpmn != null) {
                Bpmn.readModelFromStream(ByteArrayInputStream(bpmn.bytes))
            } else {
                operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(processDefinitionId!!)
            }
            operatonProcessService.getExistingProcessForFile(null, model)
        }
    }

    //TODO: this code could use a refactor
    fun deployProcessDefinitionAndProcessLinksForCaseDefinition(
        caseDefinitionId: CaseDefinitionId,
        bpmn: MultipartFile?,
        processLinks: List<ProcessLinkCreateRequestDto>,
        processDefinitionId: String?,
        canInitializeDocument: Boolean,
        startableByUser: Boolean
    ) {
        val validationOptions = ProcessDefinitionValidationOptions(
            canInitializeDocument = canInitializeDocument,
            startableByUser = startableByUser
        )
        val deployedProcessDefinitionId = deployProcessDefinitionAndProcessLinks(
            caseDefinitionId,
            bpmn,
            processLinks,
            processDefinitionId,
            validationOptions
        )

        runWithoutAuthorization {
            val processIdToUpdate = if (deployedProcessDefinitionId != null) {
                deployedProcessDefinitionId
            } else {
                val model = Bpmn.readModelFromStream(bpmn!!.inputStream)
                val previouslyDeployProcess = operatonProcessService.getExistingProcessForFile(caseDefinitionId, model)
                ProcessDefinitionId(previouslyDeployProcess.id)
            }

            processDefinitionCaseDefinitionService.createProcessDocumentDefinition(
                ProcessDocumentDefinitionRequest(
                    processDefinitionId = processIdToUpdate,
                    caseDefinitionId = caseDefinitionId,
                    canInitializeDocument = canInitializeDocument,
                    startableByUser = startableByUser
                )
            )
        }
    }

    fun deployProcessDefinitionAndProcessLinks(
        blueprintId: BlueprintId?,
        bpmn: MultipartFile?,
        processLinks: List<ProcessLinkCreateRequestDto>,
        processDefinitionId: String?,
        validationOptions: ProcessDefinitionValidationOptions = ProcessDefinitionValidationOptions()
    ): ProcessDefinitionId? {
        val deployedProcessDefinitionId: String

        if (bpmn != null) {
            val bpmnModel = Bpmn.readModelFromStream(ByteArrayInputStream(bpmn.bytes))
            val validationResult = processDefinitionValidator.validate(bpmnModel, processLinks, validationOptions)

            if (validationResult.isExecutable && !validationResult.isValid) {
                throw ProcessDefinitionValidationException(validationResult.errors)
            }

            val cleanedBpmnBytes = Bpmn.convertToString(bpmnModel).toByteArray()

            try {
                val deployment = runWithoutAuthorization {
                    operatonProcessService.deploy(
                        blueprintId,
                        bpmn.originalFilename,
                        ByteArrayInputStream(cleanedBpmnBytes),
                        true,
                        false
                    )
                }

                // If the deployment is null, the same xml was deployed before
                if (deployment == null) {
                    runWithoutAuthorization {
                        val previouslyDeployProcess =
                            operatonProcessService.getExistingProcessForFile(blueprintId, bpmnModel)
                        processLinkService.deleteProcessLinksForProcessDefinition(previouslyDeployProcess.id)
                        createProcessLinks(processLinks = processLinks, blueprintId = blueprintId)
                        updateSuspensionState(previouslyDeployProcess.id, validationResult.isExecutable)
                        publishProcessLinksDeployed(previouslyDeployProcess.id, blueprintId)
                    }
                    return null
                }

                val deployedProcessDefinition = runWithoutAuthorization {
                    operatonProcessService.getProcessDefinitionByDeploymentId(deployment.id)
                }

                deployedProcessDefinitionId = deployedProcessDefinition.id
                updateSuspensionState(deployedProcessDefinitionId, validationResult.isExecutable)
            } catch (e: ParseException) {
                val deploymentError = ProcessDefinitionValidationError(
                    elementId = "deployment",
                    elementType = "Deployment",
                    elementName = null,
                    reason = e.message ?: "BPMN parse error"
                )
                throw ProcessDefinitionValidationException(validationResult.errors + deploymentError)
            }
        } else {
            try {
                val deployment = runWithoutAuthorization {
                    operatonProcessService.duplicateProcessDefinitionById(
                        blueprintId,
                        processDefinitionId,
                        true,
                        true
                    )
                }

                if (deployment == null) {
                    return null
                }

                val deployedProcessDefinition = runWithoutAuthorization {
                    operatonProcessService.getProcessDefinitionByDeploymentId(deployment.id)
                }

                deployedProcessDefinitionId = deployedProcessDefinition.id
            } catch (e: Exception) {
                throw RuntimeException("Failed to duplicate process definition. Rolling back deployment.", e)
            }
        }
        createProcessLinks(processLinks, deployedProcessDefinitionId, blueprintId)
        publishProcessLinksDeployed(deployedProcessDefinitionId, blueprintId)

        return ProcessDefinitionId(deployedProcessDefinitionId)
    }

    /**
     * Signals that the process links of this process definition are now exactly the ones that were submitted.
     * Needed on top of the per-process-link events, because a deployment that leaves the process definition
     * without any process links writes no process link at all and would otherwise be silent.
     */
    private fun publishProcessLinksDeployed(processDefinitionId: String, blueprintId: BlueprintId?) {
        applicationEventPublisher.publishEvent(ProcessLinksDeployedEvent(processDefinitionId, blueprintId))
    }

    private fun createProcessLinks(
        processLinks: List<ProcessLinkCreateRequestDto>,
        deployedProcessDefinitionId: String? = null,
        blueprintId: BlueprintId?= null
    ) {
        try {
            processLinks.map { originalLink ->
                if (deployedProcessDefinitionId != null) {
                    copyWithNewProcessDefinitionId(originalLink, deployedProcessDefinitionId)
                } else {
                    originalLink
                }
            }.forEach { link ->
                runWithoutAuthorization {
                    processLinkService.createProcessLink(link, blueprintId)
                }
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to create process links. Rolling back deployment.", e)
        }
    }

    private fun updateSuspensionState(processDefinitionId: String, isExecutable: Boolean) {
        if (isExecutable) {
            repositoryService.activateProcessDefinitionById(processDefinitionId)
        } else {
            repositoryService.suspendProcessDefinitionById(processDefinitionId)
        }
    }

    private fun copyWithNewProcessDefinitionId(
        original: ProcessLinkCreateRequestDto,
        newProcessDefinitionId: String
    ): ProcessLinkCreateRequestDto {
        //TODO: see if there's a way to do this without reflection
        val originalClass = original::class
        val properties = originalClass.memberProperties
        val constructor = originalClass.primaryConstructor

        val args = properties.associate { prop ->
            prop.name to if (prop.name == "processDefinitionId") newProcessDefinitionId else prop.getter.call(original)
        }

        return constructor?.callBy(constructor.parameters.associateWith { args[it.name] }) as ProcessLinkCreateRequestDto
    }
}