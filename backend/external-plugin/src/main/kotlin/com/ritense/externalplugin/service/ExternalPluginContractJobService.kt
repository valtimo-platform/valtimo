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
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.ACCEPTED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.COMPLETED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.DELIVERED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.EXPIRED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.FAILED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.PENDING
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.UNDELIVERABLE
import com.ritense.externalplugin.domain.ExternalPluginManifestContracts
import com.ritense.externalplugin.event.ExternalPluginContractJobPayloadViewedEvent
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.security.ExternalPluginReplyHandleSigner
import com.ritense.externalplugin.service.ExternalPluginContractService.Resolution
import com.ritense.externalplugin.web.rest.dto.ContractJobDetailResponse
import com.ritense.externalplugin.web.rest.dto.ContractJobPayloadResponse
import com.ritense.externalplugin.web.rest.dto.ContractJobSummaryResponse
import com.ritense.externalplugin.web.rest.dto.ContractJobView
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.audit.utils.AuditHelper
import com.ritense.valtimo.contract.utils.RequestHelper
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

/**
 * The job ledger's request side: creation (`POST /jobs`), the provider's completion (ownership on the
 * row is the whole check), the read views and the administrator's controls. Delivery lives in
 * [ExternalPluginContractJobDispatcher].
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
    private val documentService: JsonSchemaDocumentService,
    private val authorizationService: AuthorizationService,
    private val replyHandleSigner: ExternalPluginReplyHandleSigner,
    private val eventPublisher: ApplicationEventPublisher,
    private val defaultTimeout: Duration,
    private val maxDeadline: Duration,
    private val clock: Clock = Clock.systemUTC(),
) {

    /**
     * @param requestedBy user login when created with a user token: the job must then name a case
     *   ([documentId]) the user may view, and cannot ask for a BPMN reply.
     * @param replyTo a reply handle from an action invocation (service tokens only); the reply then
     *   goes to that process instance.
     * @throws IllegalArgumentException for a malformed request (400)
     * @throws org.springframework.security.access.AccessDeniedException when the user may not view the case (403)
     */
    fun create(
        requesterConfigurationId: UUID,
        contract: String,
        operation: String,
        payload: JsonNode?,
        replyTo: String?,
        documentId: String?,
        idempotencyKey: String?,
        requestedBy: String?,
        chainHeader: String?,
        correlationIdHeader: String?,
    ): ContractOutcome {
        val startedAt = System.nanoTime()
        val correlationId = contractService.correlationIdOf(correlationIdHeader)
        val requestedDocumentId = documentId?.takeIf { it.isNotBlank() }

        val handle: ExternalPluginReplyHandleSigner.ReplyHandle?
        val effectiveDocumentId: String?
        if (requestedBy != null) {
            require(replyTo == null) { "replyTo requires a service token" }
            requireNotNull(requestedDocumentId) { "A user token must name the case it acts on (documentId)" }
            requireDocumentView(requestedDocumentId)
            handle = null
            effectiveDocumentId = requestedDocumentId
        } else {
            handle = replyTo?.let {
                replyHandleSigner.verify(it, requesterConfigurationId)
                    ?: throw IllegalArgumentException("replyTo is not a valid reply handle for this configuration")
            }
            val handleBusinessKey = handle?.businessKey
            require(requestedDocumentId == null || handleBusinessKey == null || requestedDocumentId == handleBusinessKey) {
                "documentId does not match the case of the reply handle"
            }
            effectiveDocumentId = requestedDocumentId ?: handleBusinessKey
            require(effectiveDocumentId == null || effectiveDocumentId.length <= MAX_DOCUMENT_ID_LENGTH) {
                "documentId must be at most $MAX_DOCUMENT_ID_LENGTH characters"
            }
        }
        require(idempotencyKey == null || IDEMPOTENCY_KEY_PATTERN.matches(idempotencyKey)) {
            "idempotencyKey must be 1-255 visible ASCII characters"
        }

        if (idempotencyKey != null) {
            replay(requesterConfigurationId, idempotencyKey, contract, operation)?.let { outcome ->
                logger.info {
                    "Contract job $correlationId: ($requesterConfigurationId) $contract/$operation answered from its " +
                        "idempotencyKey: ${outcome.jobId?.let { "job $it" } ?: outcome.errorCode}"
                }
                return outcome
            }
        }

        val resolution = contractService.resolve(
            requesterConfigurationId, contract, operation, payload, chainHeader, synchronous = false
        )
        if (resolution is Resolution.Rejected) {
            contractService.audit(
                correlationId, "job", requesterConfigurationId, resolution, contract, operation, resolution.outcome, startedAt
            )
            return resolution.outcome
        }
        resolution as Resolution.Resolved

        val now = clock.instant()
        val job = ExternalPluginContractJob(
            id = UUID.randomUUID(),
            contract = contract,
            operation = operation,
            requesterConfigurationId = requesterConfigurationId,
            providerConfigurationId = resolution.target.provider.id,
            requestedBy = requestedBy,
            documentId = effectiveDocumentId,
            idempotencyKey = idempotencyKey,
            requestPayload = encryptionService.encrypt(objectMapper.writeValueAsString(resolution.payload)),
            replyToProcessInstanceId = handle?.processInstanceId,
            replyToBusinessKey = handle?.businessKey,
            chain = resolution.chain.joinToString(","),
            deadline = now.plus(timeoutOf(resolution.operation)),
            createdAt = now,
            nextAttemptAt = now,
        )
        try {
            transactionTemplate.executeWithoutResult { jobRepository.saveAndFlush(job) }
        } catch (e: DataIntegrityViolationException) {
            // A concurrent create with the same idempotency key won the insert.
            return idempotencyKey?.let { replay(requesterConfigurationId, it, contract, operation) } ?: throw e
        }
        val outcome = ContractOutcome.accepted(job.id)
        contractService.audit(correlationId, "job", requesterConfigurationId, resolution, contract, operation, outcome, startedAt)
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
                val violation = contractService.resultViolation(operationOf(job), result)
                if (violation != null) {
                    finish(job, FAILED, null, ContractErrorCodes.PROVIDER_INVALID_RESULT, violation, now)
                    return@execute CompletionResult.Invalid(
                        ContractErrorCodes.PROVIDER_INVALID_RESULT,
                        ContractLimits.errorMessage(violation),
                    )
                }
                finish(job, COMPLETED, result?.let { objectMapper.writeValueAsString(it) }, null, null, now)
            } else {
                finish(
                    job,
                    FAILED,
                    null,
                    ContractErrorCodes.PROVIDER_ERROR,
                    errorMessage ?: "The provider reported a failure",
                    now,
                    providerErrorCode = errorCode?.takeIf { it.isNotBlank() },
                )
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
            providerErrorCode = job.providerErrorCode,
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
            outcome = job.outcome,
            requestedBy = summary.requestedBy,
            documentId = job.documentId,
            idempotencyKey = job.idempotencyKey,
            createdAt = summary.createdAt,
            updatedAt = summary.updatedAt,
            completedAt = summary.completedAt,
            deliveredAt = summary.deliveredAt,
            deadline = summary.deadline,
            deliveryAttempts = summary.deliveryAttempts,
            errorCode = summary.errorCode,
            providerErrorCode = summary.providerErrorCode,
            errorMessage = summary.errorMessage,
            replyToProcessInstanceId = job.replyToProcessInstanceId,
            lastDeliveryError = job.lastDeliveryError,
        )
    }

    /** Decrypted payloads for an administrator; every read is an audit event. */
    fun payload(jobId: UUID, viewedBy: String): ContractJobPayloadResponse? {
        val job = jobRepository.findById(jobId).orElse(null) ?: return null
        val response = ContractJobPayloadResponse(
            requestPayload = decryptJson(job.requestPayload),
            resultPayload = decryptJson(job.resultPayload),
        )
        eventPublisher.publishEvent(
            ExternalPluginContractJobPayloadViewedEvent(
                UUID.randomUUID(),
                RequestHelper.getOrigin(),
                LocalDateTime.now(),
                AuditHelper.getActor(),
                job.documentId?.let { runCatching { UUID.fromString(it) }.getOrNull() },
                job.id,
                job.contract,
                job.operation,
            )
        )
        logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} payloads viewed by $viewedBy" }
        return response
    }

    /**
     * An open job fails as cancelled and its reply goes out as usual; a finished job's reply is
     * abandoned. Delivered and undeliverable jobs are past cancelling.
     */
    fun cancel(jobId: UUID, cancelledBy: String): AdminJobResult = adminTransition(jobId) { job, now ->
        when (job.status) {
            PENDING, ACCEPTED -> finish(
                job, FAILED, null, ContractErrorCodes.CONTRACT_JOB_CANCELLED, "Cancelled by $cancelledBy", now,
            )
            COMPLETED, FAILED, EXPIRED -> {
                job.status = UNDELIVERABLE
                job.nextAttemptAt = null
                job.lastDeliveryError = ContractLimits.errorMessage("Reply delivery cancelled by $cancelledBy")
                job.updatedAt = now
                jobRepository.save(job)
            }
            DELIVERED, UNDELIVERABLE -> return@adminTransition false
        }
        logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} cancelled by $cancelledBy" }
        true
    }

    /** Puts an undeliverable reply back in the queue with a fresh attempt budget. */
    fun redeliver(jobId: UUID, requestedBy: String): AdminJobResult = adminTransition(jobId) { job, now ->
        val outcome = job.outcome
        if (job.status != UNDELIVERABLE || outcome == null) return@adminTransition false
        job.status = outcome
        job.deliveryAttempts = 0
        job.nextAttemptAt = now
        job.lastDeliveryError = null
        job.updatedAt = now
        jobRepository.save(job)
        logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} reply redelivery requested by $requestedBy" }
        true
    }

    fun decryptJson(ciphertext: String?): JsonNode? = ciphertext?.let { objectMapper.readTree(encryptionService.decrypt(it)) }

    fun operationOf(job: ExternalPluginContractJob): ExternalPluginManifestContracts.Operation? {
        val provider = configurationRepository.findById(job.providerConfigurationId).orElse(null) ?: return null
        val definition = definitionRepository.findById(provider.definitionId).orElse(null) ?: return null
        return ExternalPluginManifestContracts.findOperation(definition.manifestJson, job.contract, job.operation)
    }

    /**
     * Ends the provider side of a job. Reply delivery starts afresh: request-delivery attempts are not
     * reply attempts. [status] becomes the job's lasting [ExternalPluginContractJob.outcome].
     */
    internal fun finish(
        job: ExternalPluginContractJob,
        status: ExternalPluginContractJobStatus,
        resultJson: String?,
        errorCode: String?,
        errorMessage: String?,
        now: Instant,
        providerErrorCode: String? = null,
    ) {
        job.status = status
        job.outcome = status
        job.resultPayload = resultJson?.let { encryptionService.encrypt(it) }
        job.errorCode = errorCode
        job.providerErrorCode = providerErrorCode?.let(ContractLimits::providerErrorCode)
        job.errorMessage = errorMessage?.let(ContractLimits::errorMessage)
        job.completedAt = now
        job.updatedAt = now
        job.deliveryAttempts = 0
        job.nextAttemptAt = now
        job.lastDeliveryError = null
        jobRepository.save(job)
    }

    /** Provider's declared `timeout`, else the default, never beyond the platform maximum. */
    private fun timeoutOf(operation: ExternalPluginManifestContracts.Operation): Duration {
        val declared = operation.timeoutDuration ?: defaultTimeout
        return if (declared > maxDeadline) maxDeadline else declared
    }

    /** Same idempotency key, same contract and operation: the existing job. Otherwise a conflict. */
    private fun replay(
        requesterConfigurationId: UUID,
        idempotencyKey: String,
        contract: String,
        operation: String,
    ): ContractOutcome? {
        val existing = transactionTemplate.execute {
            jobRepository.findByRequesterConfigurationIdAndIdempotencyKey(requesterConfigurationId, idempotencyKey)
        } ?: return null
        return if (existing.contract == contract && existing.operation == operation) {
            ContractOutcome.accepted(existing.id)
        } else {
            ContractOutcome.error(
                ContractErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
                "idempotencyKey '$idempotencyKey' was already used for ${existing.contract}/${existing.operation}",
            )
        }
    }

    private fun adminTransition(jobId: UUID, change: (ExternalPluginContractJob, Instant) -> Boolean): AdminJobResult {
        val changed = transactionTemplate.execute {
            val job = jobRepository.findByIdForUpdate(jobId) ?: return@execute null
            change(job, clock.instant())
        } ?: return AdminJobResult.NotFound
        if (!changed) return AdminJobResult.Conflict
        return detail(jobId)?.let { AdminJobResult.Updated(it) } ?: AdminJobResult.NotFound
    }

    private fun requireDocumentView(documentId: String) {
        val id = try {
            UUID.fromString(documentId)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException("documentId '$documentId' is not a valid document id")
        }
        val document = runWithoutAuthorization { documentService.findBy(JsonSchemaDocumentId.existingId(id)) }.orElse(null)
            ?: throw IllegalArgumentException("documentId '$documentId' does not exist")
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
        providerErrorCode = job.providerErrorCode,
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

    sealed interface AdminJobResult {
        data class Updated(val job: ContractJobDetailResponse) : AdminJobResult
        data object NotFound : AdminJobResult
        data object Conflict : AdminJobResult
    }

    companion object {
        const val STATUS_COMPLETED = "completed"
        const val STATUS_FAILED = "failed"
        private const val MAX_DOCUMENT_ID_LENGTH = 255
        private val IDEMPOTENCY_KEY_PATTERN = Regex("^[\\x21-\\x7E]{1,255}$")
        private val logger = KotlinLogging.logger {}
    }
}
