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

package com.ritense.externalplugin.processlink.web

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormSubmissionService
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormSubmissionResult
import com.ritense.logging.LoggableResource
import com.ritense.processlink.domain.ProcessLink
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.operaton.domain.OperatonTask
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * Submission endpoint for external-plugin `task-form` process links — the plugin counterpart of
 * `FormResource.handleSubmission`. The Angular parent (not the iframe) POSTs the collected data here
 * under the logged-in user's session; GZAC completes the task the standard way. The iframe never
 * holds a token and never names the task id — the authoritative `taskInstanceId` is a query param the
 * parent supplies from the process-link result.
 */
@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginTaskFormSubmissionResource(
    private val submissionService: ExternalPluginTaskFormSubmissionService,
) {

    @EndpointDescription(
        en = "Handle an external-plugin task-form submission",
        nl = "Formulierinzending voor externe-plugin taakformulier verwerken",
    )
    @PostMapping("/v1/process-link/{processLinkId}/external-plugin-task-form/submission")
    fun handleSubmission(
        @LoggableResource(resourceType = ProcessLink::class) @PathVariable processLinkId: UUID,
        @LoggableResource(resourceType = JsonSchemaDocument::class) @RequestParam(required = false) documentId: String?,
        @LoggableResource(resourceType = OperatonTask::class) @RequestParam(required = false) taskInstanceId: String?,
        @RequestBody submission: JsonNode,
    ): ResponseEntity<ExternalPluginTaskFormSubmissionResult> {
        val result = submissionService.handleSubmission(processLinkId, submission, documentId, taskInstanceId)
        val status = if (result.errors.isEmpty() && result.fieldErrors.isEmpty()) HttpStatus.OK else HttpStatus.BAD_REQUEST
        return ResponseEntity.status(status).body(result)
    }
}
