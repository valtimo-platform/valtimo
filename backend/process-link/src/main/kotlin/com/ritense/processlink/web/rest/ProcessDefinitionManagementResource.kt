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

import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.logging.LoggableResource
import com.ritense.processlink.service.ProcessDefinitionImportPreviewService
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.validation.ProcessDefinitionValidationOptions
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.processlink.web.rest.dto.ProcessDefinitionConflictResponseDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionImportPreviewResponseDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionImportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionValidateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionValidateResponseDto
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.processautofill.service.ProcessDefinitionAutofillService
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.service.ProcessPropertyService
import com.ritense.valtimo.web.rest.dto.ProcessDefinitionWithPropertiesDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.stream.Collectors

/**
 * Manages the process definitions that are not part of a case definition ("system" processes),
 * together with their process links, under `/api/management/v1/process-definition`. This includes
 * the export and import of a process definition and its referenced elements.
 */
@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class ProcessDefinitionManagementResource(
    private val operatonProcessService: OperatonProcessService,
    private val processPropertyService: ProcessPropertyService,
    private val processLinkService: ProcessLinkService,
    private val processDeploymentService: ProcessDeploymentService,
    private val processDefinitionValidator: ProcessDefinitionValidator,
    private val processDefinitionAutofillService: ProcessDefinitionAutofillService,
    private val exportService: ExportService,
    private val importService: ImportService,
    private val processDefinitionImportPreviewService: ProcessDefinitionImportPreviewService,
    private val objectMapper: ObjectMapper,
    private val assembler: ProcessDefinitionResponseAssembler,
) {

    @GetMapping("/management/v1/process-definition")
    @Transactional
    fun getUnlinkedProcessDefinitionsAndProcessLinks(): ResponseEntity<List<ProcessDefinitionResponseDto>> {
        val definitions = runWithoutAuthorization {
            operatonProcessService
                .getUnlinkedDeployedDefinitions()
                .stream()
                .map { definition ->
                    ProcessDefinitionResponseDto(
                        toDto(definition),
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

    @GetMapping("/management/v1/process-definition/key/{processDefinitionKey}")
    @Transactional
    fun getUnlinkedProcessDefinitionsByKeyList(
        @PathVariable("processDefinitionKey") processDefinitionKey: String
    ): ResponseEntity<List<ProcessDefinitionResponseDto>> {
        val definitions = runWithoutAuthorization {
            operatonProcessService.getUnlinkedDeployedDefinitionsByKey(processDefinitionKey)
        }

        val responseDtos = definitions.map { definition ->
            ProcessDefinitionResponseDto(
                toDto(definition),
                assembler.processLinks(definition),
                assembler.bpmnXml(definition),
                definition.isSuspended(),
                assembler.autofilledElements(definition)
            )
        }.sortedBy { it.processDefinition.version }

        return ResponseEntity.ok(responseDtos)
    }

    @GetMapping("/management/v1/process-definition/{processDefinitionKey}")
    @Transactional
    fun getUnlinkedProcessDefinitionsWithLinks(
        @PathVariable("processDefinitionKey") processDefinitionKey: String
    ): ResponseEntity<List<ProcessDefinitionResponseDto>> {
        val definitions = operatonProcessService.getGlobalDefinitionsByKey(processDefinitionKey)

        val responseDto = definitions.map { definition ->
            ProcessDefinitionResponseDto(
                toDto(definition),
                assembler.processLinks(definition),
                assembler.bpmnXml(definition),
                autofilledElements = assembler.autofilledElements(definition)
            )
        }.sortedBy { it.processDefinition.version }

        return ResponseEntity.ok(responseDto)
    }

    @DeleteMapping("/management/v1/process-definition/key/{processDefinitionKey}")
    @Transactional
    fun deleteUnlinkedProcessDefinitionsAndLinksByKey(
        @PathVariable("processDefinitionKey") processDefinitionKey: String
    ): ResponseEntity<Any> {
        runWithoutAuthorization {
            operatonProcessService.getUnlinkedDeployedDefinitionsByKey(processDefinitionKey)
                .forEach { definition ->
                    processLinkService.deleteProcessLinksForProcessDefinition(definition.id)
                    operatonProcessService.deleteProcessDefinition(definition.id)
                }
        }

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @PostMapping(
        value = ["/management/v1/process-definition"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun deployUnlinkedProcessDefinitionAndProcessLinks(
        @RequestPart(name = "file") bpmn: MultipartFile?,
        @RequestPart(name = "processLinks") processLinks: List<ProcessLinkCreateRequestDto>,
        @RequestPart(name = "processDefinitionId") processDefinitionId: String?
    ): ResponseEntity<Any> {
        val existing = processDeploymentService.findExistingUnlinkedProcessDefinition(bpmn, processDefinitionId)
        if (existing != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ProcessDefinitionConflictResponseDto(existing.key, existing.id, existing.name)
            )
        }
        processDeploymentService.deployProcessDefinitionAndProcessLinks(
            null,
            bpmn,
            processLinks,
            processDefinitionId
        )

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @PutMapping(
        value = ["/management/v1/process-definition"],
        consumes = [MediaType.MULTIPART_FORM_DATA_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    @Transactional
    fun updateUnlinkedProcessDefinitionAndProcessLinks(
        @RequestPart(name = "file") bpmn: MultipartFile?,
        @RequestPart(name = "processLinks") processLinks: List<ProcessLinkCreateRequestDto>,
        @RequestPart(name = "processDefinitionId") processDefinitionId: String?
    ): ResponseEntity<Any> {
        processDeploymentService.deployProcessDefinitionAndProcessLinks(
            null,
            bpmn,
            processLinks,
            processDefinitionId
        )

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @PostMapping(
        value = ["/management/v1/process-definition/validate"],
        consumes = [MediaType.APPLICATION_JSON_VALUE],
        produces = [MediaType.APPLICATION_JSON_VALUE]
    )
    fun validateProcessDefinition(
        @RequestBody request: ProcessDefinitionValidateRequestDto
    ): ResponseEntity<ProcessDefinitionValidateResponseDto> {
        val bpmnModel = Bpmn.readModelFromStream(request.bpmnXml.byteInputStream())
        val options = ProcessDefinitionValidationOptions(
            canInitializeDocument = request.canInitializeDocument,
            startableByUser = request.startableByUser
        )
        val result = processDefinitionValidator.validate(bpmnModel, request.processLinks, options)
        return ResponseEntity.ok(
            ProcessDefinitionValidateResponseDto(
                isValid = result.isValid,
                hasWarnings = result.hasWarnings,
                errors = result.errors
            )
        )
    }

    @GetMapping(
        value = ["/management/v1/process-definition/{processDefinitionId}/export"],
        produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE]
    )
    fun exportProcessDefinition(
        @LoggableResource(resourceType = OperatonProcessDefinition::class) @PathVariable processDefinitionId: String
    ): ResponseEntity<ByteArray> {
        return runWithoutAuthorization {
            val processDefinition = operatonProcessService.getProcessDefinitionById(processDefinitionId)
            val outputStream = exportService.export(GlobalProcessDefinitionExportRequest(processDefinitionId))
            val timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm"))
            val fileName = "${processDefinition.key}_v${processDefinition.version}_$timestamp.process.zip"

            ResponseEntity
                .ok()
                .header("Content-Disposition", "attachment;filename=$fileName")
                .body(outputStream.toByteArray())
        }
    }

    @PostMapping("/management/v1/process-definition/import/preview")
    fun previewProcessDefinitionImport(
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<ProcessDefinitionImportPreviewResponseDto> {
        return try {
            ResponseEntity.ok(processDefinitionImportPreviewService.preview(file.inputStream))
        } catch (exception: ImportServiceException) {
            logger.info(exception) { "Process definition import preview failed" }
            ResponseEntity.badRequest().build()
        }
    }

    @PostMapping("/management/v1/process-definition/import")
    fun importProcessDefinition(
        @RequestParam("file") file: MultipartFile,
        @RequestPart("pluginConfigurationMappings", required = false) pluginConfigurationMappingsJson: String?,
    ): ResponseEntity<ProcessDefinitionImportResponseDto> {
        return try {
            val preview = processDefinitionImportPreviewService.preview(file.inputStream)
            val response = ProcessDefinitionImportResponseDto(
                processDefinitionKeys = preview.processDefinitionKeys,
                missingReferences = preview.missingReferences,
            )

            // Importing would either fail or overwrite a process that is managed by configuration
            if (!preview.canImport) {
                return ResponseEntity.badRequest().body(response)
            }

            val pluginConfigurationMappings: Map<UUID, UUID?>? = try {
                pluginConfigurationMappingsJson?.let { objectMapper.readValue<Map<UUID, UUID?>>(it) }
            } catch (exception: JsonProcessingException) {
                logger.info(exception) { "Could not read the plugin configuration mappings" }
                return ResponseEntity.badRequest().build()
            }
            runWithoutAuthorization {
                importService.importGlobal(file.inputStream, pluginConfigurationMappings)
            }

            ResponseEntity.ok(response)
        } catch (exception: ImportServiceException) {
            logger.info(exception) { "Process definition import failed" }
            ResponseEntity.badRequest().build()
        }
    }

    @DeleteMapping("/management/v1/process-definition/{processDefinitionId}/autofill/{activityId}")
    fun deleteAutofill(
        @LoggableResource(resourceType = OperatonProcessDefinition::class) @PathVariable processDefinitionId: String,
        @PathVariable activityId: String
    ): ResponseEntity<Void> {
        processDefinitionAutofillService.deleteByProcessDefinitionIdAndActivityId(
            processDefinitionId, activityId
        )
        return ResponseEntity.noContent().build()
    }

    private fun toDto(definition: OperatonProcessDefinition): ProcessDefinitionWithPropertiesDto {
        val dto = ProcessDefinitionWithPropertiesDto.fromProcessDefinition(definition)
        dto.setSystemProcess(processPropertyService.isKnownSystemProcess(definition.key))
        return dto
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
