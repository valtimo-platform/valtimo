/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.processlink.web.rest

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.CaseProcessDefinitionResponseDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionConflictResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.web.rest.dto.ProcessDefinitionWithPropertiesDto
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.stream.Collectors

/**
 * Manages the process definitions that are part of a case definition, together with their process
 * links, under `/api/management/v1/case-definition/{key}/version/{tag}/process-definition`.
 */
@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseProcessDefinitionManagementResource(
    private val operatonProcessService: OperatonProcessService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val processLinkService: ProcessLinkService,
    private val processDeploymentService: ProcessDeploymentService,
    private val assembler: ProcessDefinitionResponseAssembler,
) {

    @GetMapping(
        value = ["/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition"],
    )
    @Transactional
    fun getProcessDefinitionsAndProcessLinks(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("versionTag") versionTag: String
    ): ResponseEntity<List<CaseProcessDefinitionResponseDto>> {
        val definitions = runWithoutAuthorization {
            operatonProcessService
                .getAllDefinitions(CaseDefinitionId.of(caseDefinitionKey, versionTag))
                .stream()
                .map { definition: OperatonProcessDefinition? ->
                    CaseProcessDefinitionResponseDto(
                        ProcessDefinitionWithPropertiesDto.fromProcessDefinition(
                            definition
                        ),
                        processDefinitionCaseDefinitionService.findByProcessDefinitionId(
                            ProcessDefinitionId(definition!!.id)
                        ),
                        assembler.processLinks(definition),
                        assembler.bpmnXml(definition),
                        definition.isSuspended(),
                        assembler.autofilledElements(definition)
                    )
                }
                .collect(Collectors.toList())
        }

        return ResponseEntity.ok(definitions)
    }

    @GetMapping(
        value = ["/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}"]
    )
    @Transactional
    fun getProcessDefinitionByKeyWithLinks(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("versionTag") versionTag: String,
        @PathVariable("processDefinitionKey") processDefinitionKey: String
    ): ResponseEntity<CaseProcessDefinitionResponseDto> {
        val caseDefinitionId = CaseDefinitionId.of(caseDefinitionKey, versionTag)

        val definition = runWithoutAuthorization {
            operatonProcessService
                .getDefinitionsByKeyAndBlueprint(caseDefinitionId, processDefinitionKey)
                .firstOrNull()
                ?: throw IllegalStateException("No process definition found for key '$processDefinitionKey' in case definition '$caseDefinitionId'")
        }

        val responseDto = CaseProcessDefinitionResponseDto(
            ProcessDefinitionWithPropertiesDto.fromProcessDefinition(definition),
            processDefinitionCaseDefinitionService.findByProcessDefinitionId(
                ProcessDefinitionId(definition.id)
            ),
            assembler.processLinks(definition),
            assembler.bpmnXml(definition),
            definition.isSuspended(),
            assembler.autofilledElements(definition)
        )

        return ResponseEntity.ok(responseDto)
    }

    @DeleteMapping(
        value = ["/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}"],
    )
    @Transactional
    fun deleteProcessDefinitionsAndProcessLinks(
        @PathVariable("caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable("versionTag") versionTag: String,
        @PathVariable("processDefinitionKey") processDefinitionKey: String,
    ): ResponseEntity<Any> {
        runWithoutAuthorization {
            operatonProcessService
                .getDefinitionsByKeyAndBlueprint(
                    CaseDefinitionId.of(caseDefinitionKey, versionTag),
                    processDefinitionKey
                )
                .forEach { definition: OperatonProcessDefinition ->
                    processDefinitionCaseDefinitionService.deleteProcessDefinitionCaseDefinition(
                        ProcessDefinitionId(definition.id),
                        CaseDefinitionId.of(caseDefinitionKey, versionTag)
                    )
                    processLinkService.deleteProcessLinksForProcessDefinition(definition.id)
                    operatonProcessService.deleteProcessDefinition(definition.id)
                }
        }
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @PostMapping(
        value = ["/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun deployProcessDefinitionAndProcessLinks(
        @PathVariable(name = "caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable(name = "caseDefinitionVersionTag") caseDefinitionVersionTag: String,
        @RequestPart(name = "file") bpmn: MultipartFile?,
        @RequestPart(name = "processLinks") processLinks: List<ProcessLinkCreateRequestDto>,
        @RequestParam(name = "processDefinitionId") processDefinitionId: String?,
        @RequestParam(name = "canInitializeDocument") canInitializeDocument: String?,
        @RequestParam(name = "startableByUser") startableByUser: String?
    ): ResponseEntity<Any> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        val existing = processDeploymentService.findExistingProcessDefinitionForCaseDefinition(caseDefinitionId, bpmn, processDefinitionId)
        if (existing != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ProcessDefinitionConflictResponseDto(existing.key, existing.id, existing.name)
            )
        }
        processDeploymentService.deployProcessDefinitionAndProcessLinksForCaseDefinition(
            caseDefinitionId,
            bpmn,
            processLinks,
            processDefinitionId,
            canInitializeDocument.toBoolean(),
            startableByUser.toBoolean()
        )

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @PutMapping(
        value = ["/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process-definition"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun updateProcessDefinitionAndProcessLinks(
        @PathVariable(name = "caseDefinitionKey") caseDefinitionKey: String,
        @PathVariable(name = "caseDefinitionVersionTag") caseDefinitionVersionTag: String,
        @RequestPart(name = "file") bpmn: MultipartFile?,
        @RequestPart(name = "processLinks") processLinks: List<ProcessLinkCreateRequestDto>,
        @RequestParam(name = "processDefinitionId") processDefinitionId: String?,
        @RequestParam(name = "canInitializeDocument") canInitializeDocument: String?,
        @RequestParam(name = "startableByUser") startableByUser: String?
    ): ResponseEntity<Any> {
        val caseDefinitionId = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        processDeploymentService.deployProcessDefinitionAndProcessLinksForCaseDefinition(
            caseDefinitionId,
            bpmn,
            processLinks,
            processDefinitionId,
            canInitializeDocument.toBoolean(),
            startableByUser.toBoolean()
        )

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }
}
