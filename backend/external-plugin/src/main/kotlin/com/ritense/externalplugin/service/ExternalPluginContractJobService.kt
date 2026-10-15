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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginManifestContracts
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.service.ExternalPluginContractService.Resolution
import com.ritense.externalplugin.web.rest.dto.ContractJobDetailResponse
import com.ritense.externalplugin.web.rest.dto.ContractJobSummaryResponse
import com.ritense.externalplugin.web.rest.dto.ContractJobView
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * The job ledger's request side: creation (`POST /jobs`), the provider's completion (ownership on the
 * row is the whole check) and the read views. Delivery lives in [ExternalPluginContractJobDispatcher].
 */
@SkipComponentScan
class ExternalPluginContractJobService(
    private val jobRepository: ExternalPluginContractJobRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val contractService: ExternalPluginContractService,
    private val encryptionService: EncryptionService,
    private val objectMapper: ObjectMapper,
    private val transactionTemplate: TransactionTemplate,
    private val runtimeService: RuntimeService,
    private val documentService: JsonSchemaDocumentService,
    private val authorizationService: AuthorizationService,
    private val defaultTimeout: Duration,
    private val maxDeadline: Duration,
    private val maxPayloadBytes: Int,
    private val clock: Clock = Clock.systemUTC(),
) {

    /**
     * @param requestedBy user login when created with a user token; the request is then bounded by
     *   that user's PBAC on the referenced case.
     * @throws IllegalArgumentException for a malformed request (400)
     */
    fun create(
        requesterConfigurationId: UUID,
        contract: String,
        operation: String,
        payload: JsonNode?,
        replyToProcessInstanceId: String?,
        documentId: String?,
        requestedBy: String?,
        chainHeader: String?,
    ): ContractOutcome {
        val startedAt = System.nanoTime()
        val resolution = contractService.resolve(
            requesterConfigurationId, contract, operation, payload, chainHeader, synchronous = false
        )
        if (resolution is Resolution.Rejected) {
            contractService.audit(
                UUID.randomUUID(), "job", requesterConfigurationId, resolution, contract, operation, resolution.outcome, startedAt
            )
            return resolution.outcome
        }
        resolution as Resolution.Resolved

        val businessKey = replyToProcessInstanceId?.takeIf { it.isNotBlank() }?.let(::businessKeyOf)
        if (requestedBy != null) {
            documentId?.takeIf { it.isNotBlank() }?.let { requireDocumentView(parseDocumentId(it)) }
            businessKey?.let { key -> runCatching { UUID.fromString(key) }.getOrNull()?.let(::requireDocumentView) }
        }

        val now = clock.instant()
        val job = ExternalPluginContractJob(
            id = UUID.randomUUID(),
            contract = contract,
            operation = operation,
            requesterConfigurationId = requesterConfigurationId,
            providerConfigurationId = resolution.target.provider.id,
            requestedBy = requestedBy,
            requestPayload = encryptionService.encrypt(objectMapper.writeValueAsString(resolution.payload)),
            replyToProcessInstanceId = businessKey?.let { replyToProcessInstanceId },
            replyToBusinessKey = businessKey,
            chain = resolution.chain.joinToString(","),
            deadline = now.plus(timeoutOf(resolution.operation)),
            createdAt = now,
            nextAttemptAt = now,
        )
        transactionTemplate.executeWithoutResult { jobRepository.save(job) }
        val outcome = ContractOutcome(ExternalPluginContractService.STATUS_ACCEPTED, jobId = job.id)
        contractService.audit(job.id, "job", requesterConfigurationId, resolution, contract, operation, outcome, startedAt)
        return outcome
    }

    /** Provider's own job only, and only while open — anything else is indistinguishable from unknown. */
    fun complete(
        callerConfigurationId: UUID,
        jobId: UUID,
        status: String?,
        result: JsonNode?,
        errorCode: String?,
        errorMessage: String?,
    ): CompletionResult {
        if (status != STATUS_COMPLETED && status != STATUS_FAILED) {
            return CompletionResult.Invalid(null, "status must be '$STATUS_COMPLETED' or '$STATUS_FAILED'")
        }
        val resultJson = result?.let { objectMapper.writeValueAsString(it) }
        if (resultJson != null && resultJson.toByteArray().size > maxPayloadBytes) {
            return CompletionResult.Invalid(
                ContractErrorCodes.PAYLOAD_TOO_LARGE,
                "Result exceeds the maximum of $maxPayloadBytes bytes",
            )
        }
        return transactionTemplate.execute {
            val job = jobRepository.findByIdForUpdate(jobId)
            if (job == null || job.providerConfigurationId != callerConfigurationId) {
                return@execute CompletionResult.NotFound
            }
            if (job.status !in ExternalPluginContractJobStatus.AWAITING_PROVIDER) {
                return@execute CompletionResult.Conflict
            }
            val now = clock.instant()
            if (status == STATUS_COMPLETED) {
                val missing = operationOf(job)?.let { contractService.missingOutputs(it, result) }.orEmpty()
                if (missing.isNotEmpty()) {
                    val message = "Operation '${job.operation}' declares outputs that the result is missing: $missing"
                    finish(job, ExternalPluginContractJobStatus.FAILED, null, ContractErrorCodes.PROVIDER_INVALID_RESULT, message, now)
                    return@execute CompletionResult.Invalid(ContractErrorCodes.PROVIDER_INVALID_RESULT, message)
                }
                finish(job, ExternalPluginContractJobStatus.COMPLETED, resultJson, null, null, now)
            } else {
                val message = listOfNotNull(errorCode?.takeIf { it.isNotBlank() }, errorMessage ?: "The provider reported a failure")
                    .joinToString(": ")
                finish(job, ExternalPluginContractJobStatus.FAILED, null, ContractErrorCodes.PROVIDER_ERROR, message, now)
            }
            logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} completed by provider as ${job.status}" }
            CompletionResult.Completed
        }!!
    }

    /** Requester or provider only; null for anyone else. */
    fun get(callerConfigurationId: UUID, jobId: UUID): ContractJobView? {
        val job = jobRepository.findById(jobId).orElse(null) ?: return null
        if (callerConfigurationId != job.requesterConfigurationId && callerConfigurationId != job.providerConfigurationId) {
            return null
        }
        return ContractJobView(
            jobId = job.id,
            contract = job.contract,
            operation = job.operation,
            status = job.status.name.lowercase(),
            result = decryptJson(job.resultPayload),
            errorCode = job.errorCode,
            errorMessage = job.errorMessage,
            requestedAt = job.createdAt,
            completedAt = job.completedAt,
        )
    }

    fun list(status: ExternalPluginContractJobStatus?, configurationId: UUID?, pageable: Pageable): Page<ContractJobSummaryResponse> {
        val spec = Specification<ExternalPluginContractJob> { root, _, cb ->
            val predicates = listOfNotNull(
                status?.let { cb.equal(root.get<ExternalPluginContractJobStatus>("status"), it) },
                configurationId?.let {
                    cb.or(
                        cb.equal(root.get<UUID>("requesterConfigurationId"), it),
                        cb.equal(root.get<UUID>("providerConfigurationId"), it),
                    )
                },
            )
            cb.and(*predicates.toTypedArray())
        }
        val page = jobRepository.findAll(spec, pageable)
        val parties = Parties(page.content.flatMap { listOf(it.requesterConfigurationId, it.providerConfigurationId) })
        return page.map { summary(it, parties) }
    }

    fun detail(jobId: UUID): ContractJobDetailResponse? {
        val job = jobRepository.findById(jobId).orElse(null) ?: return null
        val parties = Parties(listOf(job.requesterConfigurationId, job.providerConfigurationId))
        val summary = summary(job, parties)
        return ContractJobDetailResponse(
            id = summary.id,
            contract = summary.contract,
            operation = summary.operation,
            requesterConfigurationId = summary.requesterConfigurationId,
            requesterTitle = summary.requesterTitle,
            requesterPluginId = summary.requesterPluginId,
            providerConfigurationId = summary.providerConfigurationId,
            providerTitle = summary.providerTitle,
            providerPluginId = summary.providerPluginId,
            status = summary.status,
            requestedBy = summary.requestedBy,
            createdAt = summary.createdAt,
            updatedAt = summary.updatedAt,
            completedAt = summary.completedAt,
            deliveredAt = summary.deliveredAt,
            deadline = summary.deadline,
            deliveryAttempts = summary.deliveryAttempts,
            errorCode = summary.errorCode,
            errorMessage = summary.errorMessage,
            requestPayload = decryptJson(job.requestPayload),
            resultPayload = decryptJson(job.resultPayload),
            replyToProcessInstanceId = job.replyToProcessInstanceId,
            lastDeliveryError = job.lastDeliveryError,
        )
    }

    fun decryptJson(ciphertext: String?): JsonNode? = ciphertext?.let { objectMapper.readTree(encryptionService.decrypt(it)) }

    fun operationOf(job: ExternalPluginContractJob): ExternalPluginManifestContracts.Operation? {
        val provider = configurationRepository.findById(job.providerConfigurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(provider.definitionId).orElse(null) ?: return null
        return ExternalPluginManifestContracts.findOperation(definition.manifestJson, job.contract, job.operation)
    }

    /** Provider's declared `timeout`, else the default, never beyond the platform maximum. */
    private fun timeoutOf(operation: ExternalPluginManifestContracts.Operation): Duration {
        val declared = operation.timeoutDuration ?: defaultTimeout
        return if (declared > maxDeadline) maxDeadline else declared
    }

    private fun finish(
        job: ExternalPluginContractJob,
        status: ExternalPluginContractJobStatus,
        resultJson: String?,
        errorCode: String?,
        errorMessage: String?,
        now: Instant,
    ) {
        job.status = status
        job.resultPayload = resultJson?.let { encryptionService.encrypt(it) }
        job.errorCode = errorCode
        job.errorMessage = errorMessage
        job.completedAt = now
        job.updatedAt = now
        // Reply delivery starts afresh: request-delivery attempts are not reply attempts.
        job.deliveryAttempts = 0
        job.nextAttemptAt = now
        job.lastDeliveryError = null
        jobRepository.save(job)
    }

    private fun businessKeyOf(processInstanceId: String): String {
        val instance = runtimeService.createProcessInstanceQuery().processInstanceId(processInstanceId).singleResult()
            ?: throw IllegalArgumentException("replyTo.processInstanceId '$processInstanceId' is not a running process instance")
        return instance.businessKey?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException(
                "Process instance '$processInstanceId' has no business key, so a reply cannot be correlated to it"
            )
    }

    private fun parseDocumentId(documentId: String): UUID = try {
        UUID.fromString(documentId)
    } catch (e: IllegalArgumentException) {
        throw IllegalArgumentException("documentId '$documentId' is not a valid document id")
    }

    /** Throws AccessDeniedException when the user may not view the case. */
    private fun requireDocumentView(documentId: UUID) {
        val document = runWithoutAuthorization { documentService.get(documentId) }
        authorizationService.requirePermission(
            EntityAuthorizationRequest(JsonSchemaDocument::class.java, JsonSchemaDocumentActionProvider.VIEW, document)
        )
    }

    private fun summary(job: ExternalPluginContractJob, parties: Parties) = ContractJobSummaryResponse(
        id = job.id,
        contract = job.contract,
        operation = job.operation,
        requesterConfigurationId = job.requesterConfigurationId,
        requesterTitle = parties.title(job.requesterConfigurationId),
        requesterPluginId = parties.pluginId(job.requesterConfigurationId),
        providerConfigurationId = job.providerConfigurationId,
        providerTitle = parties.title(job.providerConfigurationId),
        providerPluginId = parties.pluginId(job.providerConfigurationId),
        status = job.status,
        requestedBy = job.requestedBy,
        createdAt = job.createdAt,
        updatedAt = job.updatedAt,
        completedAt = job.completedAt,
        deliveredAt = job.deliveredAt,
        deadline = job.deadline,
        deliveryAttempts = job.deliveryAttempts,
        errorCode = job.errorCode,
        errorMessage = job.errorMessage,
    )

    /** Titles and plugin ids for a page of jobs, in two queries instead of two per row. */
    private inner class Parties(ids: Collection<UUID>) {
        private val configurations = configurationRepository.findAllById(ids.toSet()).associateBy { it.id }
        private val definitions = definitionRepository.findAllById(configurations.values.map { it.definitionId }.toSet())
            .associateBy { it.id }

        fun title(id: UUID): String? = configurations[id]?.title
        fun pluginId(id: UUID): String? = configurations[id]?.let { definitions[it.definitionId]?.pluginId }
    }

    sealed interface CompletionResult {
        data object Completed : CompletionResult
        data object NotFound : CompletionResult
        data object Conflict : CompletionResult
        data class Invalid(val errorCode: String?, val errorMessage: String) : CompletionResult
    }

    companion object {
        const val STATUS_COMPLETED = "completed"
        const val STATUS_FAILED = "failed"
        private val logger = KotlinLogging.logger {}
    }
}
