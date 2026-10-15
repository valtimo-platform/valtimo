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

package com.ritense.externalplugin.web.rest

import com.ritense.externalplugin.security.ExternalPluginServicePrincipal
import com.ritense.externalplugin.security.ExternalPluginUserPrincipal
import com.ritense.externalplugin.service.ContractLimits
import com.ritense.externalplugin.service.ContractOutcome
import com.ritense.externalplugin.service.ExternalPluginContractJobService
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import com.ritense.externalplugin.service.ExternalPluginContractService
import com.ritense.externalplugin.service.ExternalPluginContractService.Companion.CHAIN_HEADER
import com.ritense.externalplugin.service.ExternalPluginContractService.Companion.CORRELATION_ID_HEADER
import com.ritense.externalplugin.service.ExternalPluginContractService.Companion.TIMEOUT_HEADER
import com.ritense.externalplugin.web.rest.dto.ContractCallRequest
import com.ritense.externalplugin.web.rest.dto.ContractJobCompleteRequest
import com.ritense.externalplugin.web.rest.dto.ContractJobCreateRequest
import com.ritense.externalplugin.web.rest.dto.ContractJobView
import com.ritense.externalplugin.web.rest.dto.ContractResponse
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import java.util.UUID

/**
 * Plugin → GZAC contract surface. Mounted outside `/api/v1/external-plugin` (denylisted for
 * plugin tokens); the allowlist filter lets service principals through and this controller is the
 * gate: the token names the calling configuration, and only its own bindings and jobs are reachable.
 * Service tokens everywhere; a user token only creates jobs — when the endpoint is granted, and
 * bounded by that user's PBAC on the case it names.
 */
@Controller
@SkipComponentScan
@RequestMapping("/api/v1/plugin-contract", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginContractResource(
    private val contractService: ExternalPluginContractService,
    private val jobService: ExternalPluginContractJobService,
) {

    @EndpointDescription(
        en = "Call a contract operation on the bound provider plugin",
        nl = "Een contractoperatie aanroepen op de gekoppelde aanbiedende plugin",
    )
    @PostMapping("/call")
    fun call(
        @RequestBody request: ContractCallRequest,
        @RequestHeader(CHAIN_HEADER, required = false) chain: String?,
        @RequestHeader(TIMEOUT_HEADER, required = false) timeoutMs: String?,
        @RequestHeader(CORRELATION_ID_HEADER, required = false) correlationId: String?,
    ): ResponseEntity<ContractResponse> {
        val caller = servicePrincipal() ?: return forbidden()
        val (contract, operation) = target(request.contract, request.operation) ?: return badRequest()
        val outcome = try {
            contractService.call(caller.pluginConfigId, contract, operation, request.payload, chain, timeoutMs, correlationId)
        } catch (e: IllegalArgumentException) {
            return badRequest(e.message)
        }
        return ResponseEntity.ok(outcome.toResponse())
    }

    @EndpointDescription(
        en = "Request a long-running contract job from the bound provider plugin",
        nl = "Een langlopende contracttaak aanvragen bij de gekoppelde aanbiedende plugin",
    )
    @PostMapping("/jobs")
    fun createJob(
        @RequestBody request: ContractJobCreateRequest,
        @RequestHeader(CHAIN_HEADER, required = false) chain: String?,
        @RequestHeader(CORRELATION_ID_HEADER, required = false) correlationId: String?,
    ): ResponseEntity<ContractResponse> {
        val principal = SecurityContextHolder.getContext().authentication?.principal
        val (configurationId, requestedBy) = when (principal) {
            is ExternalPluginServicePrincipal -> principal.pluginConfigId to null
            is ExternalPluginUserPrincipal -> principal.pluginConfigId to principal.userLogin
            else -> return forbidden()
        }
        val (contract, operation) = target(request.contract, request.operation) ?: return badRequest()
        val outcome = try {
            jobService.create(
                requesterConfigurationId = configurationId,
                contract = contract,
                operation = operation,
                payload = request.payload,
                replyTo = request.replyTo,
                documentId = request.documentId,
                idempotencyKey = request.idempotencyKey,
                requestedBy = requestedBy,
                chainHeader = chain,
                correlationIdHeader = correlationId,
            )
        } catch (e: IllegalArgumentException) {
            return badRequest(e.message)
        }
        val status = if (outcome.jobId != null) HttpStatus.ACCEPTED else HttpStatus.OK
        return ResponseEntity.status(status).body(outcome.toResponse())
    }

    @EndpointDescription(
        en = "Complete a contract job accepted by this provider plugin",
        nl = "Een door deze aanbiedende plugin geaccepteerde contracttaak afronden",
    )
    @PostMapping("/jobs/{jobId}/complete")
    fun completeJob(
        @PathVariable jobId: UUID,
        @RequestBody request: ContractJobCompleteRequest,
    ): ResponseEntity<ContractResponse> {
        val caller = servicePrincipal() ?: return forbidden()
        return when (
            val result = jobService.complete(
                caller.pluginConfigId, jobId, request.status, request.result, request.errorCode, request.errorMessage
            )
        ) {
            CompletionResult.Completed -> ResponseEntity.ok(ContractResponse(status = ExternalPluginContractService.STATUS_COMPLETED))
            CompletionResult.NotFound -> ResponseEntity.notFound().build()
            CompletionResult.Conflict -> ResponseEntity.status(HttpStatus.CONFLICT).build()
            is CompletionResult.Invalid -> ResponseEntity.badRequest().body(
                ContractResponse(
                    status = ExternalPluginContractService.STATUS_ERROR,
                    errorCode = result.errorCode,
                    errorMessage = ContractLimits.errorMessage(result.errorMessage),
                )
            )
        }
    }

    @EndpointDescription(
        en = "Get a contract job this plugin requested or provides",
        nl = "Een contracttaak ophalen die deze plugin heeft aangevraagd of uitvoert",
    )
    @GetMapping("/jobs/{jobId}")
    fun getJob(@PathVariable jobId: UUID): ResponseEntity<ContractJobView> {
        val caller = servicePrincipal() ?: return forbidden()
        val job = jobService.get(caller.pluginConfigId, jobId) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(job)
    }

    private fun servicePrincipal(): ExternalPluginServicePrincipal? =
        SecurityContextHolder.getContext().authentication?.principal as? ExternalPluginServicePrincipal

    private fun target(contract: String?, operation: String?): Pair<String, String>? {
        val c = contract?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val o = operation?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return c to o
    }

    private fun <T> forbidden(): ResponseEntity<T> = ResponseEntity.status(HttpStatus.FORBIDDEN).build()

    private fun badRequest(message: String? = null): ResponseEntity<ContractResponse> =
        ResponseEntity.badRequest().body(
            ContractResponse(
                status = ExternalPluginContractService.STATUS_ERROR,
                errorMessage = ContractLimits.errorMessage(message ?: "contract and operation are required"),
            )
        )

    private fun ContractOutcome.toResponse() = ContractResponse(
        status = status,
        result = result,
        jobId = jobId,
        errorCode = errorCode,
        errorMessage = errorMessage,
        providerErrorCode = providerErrorCode,
    )
}
