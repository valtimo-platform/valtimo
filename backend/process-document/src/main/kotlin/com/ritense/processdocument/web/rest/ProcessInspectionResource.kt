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

package com.ritense.processdocument.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.event.ProcessVariableInspectionEditedEvent
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.web.rest.dto.JobInspectionDto
import com.ritense.processdocument.web.rest.dto.ProcessInstanceInspectionDto
import com.ritense.processdocument.web.rest.dto.TaskInspectionDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.utils.RequestHelper
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byProcessInstanceId
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.web.rest.dto.IncidentDto
import com.ritense.valtimo.web.rest.dto.ProcessVariableDto
import com.ritense.valtimo.web.rest.dto.ProcessVariableMutationRequest
import jakarta.validation.Valid
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class ProcessInspectionResource(
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val runtimeService: RuntimeService,
    private val historyService: HistoryService,
    private val managementService: ManagementService,
    private val operatonTaskService: OperatonTaskService,
    private val buildingBlockProcessLookup: BuildingBlockProcessLookup?,
    private val eventPublisher: ApplicationEventPublisher,
    private val objectMapper: ObjectMapper,
) {

    @GetMapping("/v1/case/{caseId}/processes")
    fun getProcessInspection(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID
    ): ResponseEntity<List<ProcessInstanceInspectionDto>> {
        loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT)

        val instances = runWithoutAuthorization {
            processDocumentAssociationService.findProcessDocumentInstanceDtos(
                JsonSchemaDocumentId.existingId(caseId)
            )
        }

        val rows = instances.map { instance ->
            buildRow(instance as ProcessDocumentInstanceDto)
        }

        return ResponseEntity.ok(rows)
    }

    @PostMapping("/v1/case/{caseId}/process-instance/{processInstanceId}/variables")
    fun createVariable(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
        @RequestBody @Valid request: ProcessVariableMutationRequest,
    ): ResponseEntity<Void> {
        loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT_MODIFY)
        requireBelongsToCase(caseId, processInstanceId)
        requireActive(processInstanceId)

        val existing = runWithoutAuthorization {
            findVariableInstance(processInstanceId, request.name())
        }
        if (existing != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build()
        }

        runWithoutAuthorization {
            runtimeService.setVariable(processInstanceId, request.name(), request.type().toTypedValue(request.value()))
        }

        publishEvent(
            caseId = caseId,
            processInstanceId = processInstanceId,
            variableName = request.name(),
            mutation = ProcessVariableInspectionEditedEvent.Mutation.CREATE,
            previousValue = null,
            newValue = request.value(),
        )

        return ResponseEntity.status(HttpStatus.CREATED).build()
    }

    @PutMapping("/v1/case/{caseId}/process-instance/{processInstanceId}/variables/{name}")
    fun updateVariable(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
        @PathVariable name: String,
        @RequestBody @Valid request: ProcessVariableMutationRequest,
    ): ResponseEntity<Void> {
        loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT_MODIFY)
        requireBelongsToCase(caseId, processInstanceId)
        requireActive(processInstanceId)

        val previousInstance = runWithoutAuthorization {
            findVariableInstance(processInstanceId, name)
        } ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()

        runWithoutAuthorization {
            runtimeService.setVariable(processInstanceId, name, request.type().toTypedValue(request.value()))
        }

        publishEvent(
            caseId = caseId,
            processInstanceId = processInstanceId,
            variableName = name,
            mutation = ProcessVariableInspectionEditedEvent.Mutation.UPDATE,
            previousValue = previousInstance.value,
            newValue = request.value(),
        )

        return ResponseEntity.ok().build()
    }

    @DeleteMapping("/v1/case/{caseId}/process-instance/{processInstanceId}/variables/{name}")
    fun deleteVariable(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
        @PathVariable name: String,
    ): ResponseEntity<Void> {
        loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT_MODIFY)
        requireBelongsToCase(caseId, processInstanceId)
        requireActive(processInstanceId)

        val previousInstance = runWithoutAuthorization {
            findVariableInstance(processInstanceId, name)
        } ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()

        runWithoutAuthorization {
            runtimeService.removeVariables(processInstanceId, listOf(name))
        }

        publishEvent(
            caseId = caseId,
            processInstanceId = processInstanceId,
            variableName = name,
            mutation = ProcessVariableInspectionEditedEvent.Mutation.DELETE,
            previousValue = previousInstance.value,
            newValue = null,
        )

        return ResponseEntity.noContent().build()
    }

    private fun loadAndAuthorize(
        caseId: UUID,
        action: com.ritense.authorization.Action<JsonSchemaDocument>,
    ): JsonSchemaDocument {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                action,
                document,
            )
        )

        return document
    }

    private fun requireBelongsToCase(caseId: UUID, processInstanceId: String) {
        val belongs = runWithoutAuthorization {
            processDocumentAssociationService.findProcessDocumentInstanceDtos(
                JsonSchemaDocumentId.existingId(caseId)
            )
        }.any { (it as ProcessDocumentInstanceDto).processDocumentInstanceId().processInstanceId().toString() == processInstanceId }

        if (!belongs) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Process instance $processInstanceId is not associated with case $caseId"
            )
        }
    }

    private fun findVariableInstance(processInstanceId: String, name: String) =
        runtimeService.createVariableInstanceQuery()
            .processInstanceIdIn(processInstanceId)
            .variableName(name)
            .singleResult()

    private fun requireActive(processInstanceId: String) {
        val active = runWithoutAuthorization {
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        }
        if (active == null) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Process instance $processInstanceId is not active"
            )
        }
    }

    private fun publishEvent(
        caseId: UUID,
        processInstanceId: String,
        variableName: String,
        mutation: ProcessVariableInspectionEditedEvent.Mutation,
        previousValue: Any?,
        newValue: Any?,
    ) {
        eventPublisher.publishEvent(
            ProcessVariableInspectionEditedEvent(
                UUID.randomUUID(),
                RequestHelper.getOrigin(),
                LocalDateTime.now(),
                AuditHelper.getActor(),
                caseId,
                processInstanceId,
                variableName,
                mutation,
                previousValue?.let { objectMapper.writeValueAsString(it) },
                newValue?.let { objectMapper.writeValueAsString(it) },
            )
        )
    }

    private fun buildRow(instance: ProcessDocumentInstanceDto): ProcessInstanceInspectionDto {
        val processInstanceId = instance.processDocumentInstanceId().processInstanceId().toString()

        val incidents = runWithoutAuthorization {
            runtimeService.createIncidentQuery()
                .processInstanceId(processInstanceId)
                .list()
                .map(IncidentDto::from)
        }

        val variables = runWithoutAuthorization {
            runtimeService.createVariableInstanceQuery()
                .processInstanceIdIn(processInstanceId)
                .list()
                .map { variable ->
                    val safeValue = runCatching { variable.value }.getOrNull()
                    ProcessVariableDto(variable.name, variable.typeName, safeValue)
                }
        }

        val historicProcess = runWithoutAuthorization {
            historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        }
        val definitionId = historicProcess?.processDefinitionId

        val jobs = runWithoutAuthorization {
            val rawJobs = managementService.createJobQuery()
                .processInstanceId(processInstanceId)
                .list()
            val definitionsById: Map<String, org.operaton.bpm.engine.management.JobDefinition> =
                if (rawJobs.isEmpty() || definitionId == null) {
                    emptyMap()
                } else {
                    managementService.createJobDefinitionQuery()
                        .processDefinitionId(definitionId)
                        .list()
                        .associateBy { it.id }
                }
            rawJobs.map { job -> JobInspectionDto.from(job, definitionsById[job.jobDefinitionId]) }
        }

        val tasks = runWithoutAuthorization {
            operatonTaskService.findTasks(byProcessInstanceId(processInstanceId), Sort.unsorted())
                .map(TaskInspectionDto::from)
        }

        val definitionKey = definitionId?.substringBefore(':')
        val startedByUserId = historicProcess?.startUserId

        val buildingBlock = buildingBlockProcessLookup?.findForProcessInstance(processInstanceId)

        return ProcessInstanceInspectionDto(
            processInstanceId = processInstanceId,
            processDefinitionId = definitionId,
            processDefinitionKey = definitionKey,
            processName = instance.processName(),
            version = instance.version,
            latestVersion = instance.latestVersion,
            active = instance.isActive,
            startedBy = instance.startedBy,
            startedByUserId = startedByUserId,
            startedOn = instance.startedOn,
            incidents = incidents,
            tasks = tasks,
            variables = variables,
            jobs = jobs,
            buildingBlock = buildingBlock,
        )
    }
}
