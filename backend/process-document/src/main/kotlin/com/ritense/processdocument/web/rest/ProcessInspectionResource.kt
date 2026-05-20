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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.web.rest.dto.JobInspectionDto
import com.ritense.processdocument.web.rest.dto.ProcessInstanceInspectionDto
import com.ritense.processdocument.web.rest.dto.TaskInspectionDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byProcessInstanceId
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.web.rest.dto.IncidentDto
import com.ritense.valtimo.web.rest.dto.ProcessVariableDto
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.ManagementService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.data.domain.Sort
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
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
) {

    @GetMapping("/v1/case/{caseId}/processes")
    fun getProcessInspection(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID
    ): ResponseEntity<List<ProcessInstanceInspectionDto>> {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                JsonSchemaDocumentActionProvider.INSPECT,
                document,
            )
        )

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
