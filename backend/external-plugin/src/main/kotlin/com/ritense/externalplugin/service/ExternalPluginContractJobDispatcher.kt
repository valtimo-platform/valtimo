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
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.ACCEPTED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.COMPLETED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.DELIVERED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.EXPIRED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.FAILED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.PENDING
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.UNDELIVERABLE
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginContractService.ContractTarget
import com.ritense.externalplugin.service.ExternalPluginContractService.ProviderLookup
import com.ritense.externalplugin.service.ExternalPluginContractService.ProviderReply
import com.ritense.plugin.service.EncryptionService
import com.ritense.processdocument.service.CorrelationService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * Drives the job ledger: expires overdue jobs, delivers pending requests to providers and replies
 * to requesters (their host, or a waiting BPMN message catch), and purges the audit window.
 * At-least-once on both hops — the job id is the idempotency key.
 *
 * Every HTTP call runs outside a transaction; each state change re-reads the row under a lock and
 * only applies when the job is still in the state the delivery started from, so a provider's
 * concurrent completion always wins over a late delivery answer.
 */
@SkipComponentScan
class ExternalPluginContractJobDispatcher(
    private val jobRepository: ExternalPluginContractJobRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val hostRepository: ExternalPluginHostRepository,
    private val contractService: ExternalPluginContractService,
    private val jobService: ExternalPluginContractJobService,
    private val hostClient: ExternalPluginHostClient,
    private val encryptionService: EncryptionService,
    private val objectMapper: ObjectMapper,
    private val transactionTemplate: TransactionTemplate,
    private val correlationService: CorrelationService,
    private val retryBase: Duration,
    private val retryMax: Duration,
    private val maxReplyAttempts: Int,
    private val retention: Duration,
    private val batchSize: Int,
    private val clock: Clock = Clock.systemUTC(),
) {

    fun dispatch() {
        step("expire overdue jobs") { expireOverdue() }
        step("deliver requests") { deliverRequests() }
        step("deliver replies") { deliverReplies() }
        step("purge delivered jobs") { purge() }
    }

    fun expireOverdue() {
        val now = clock.instant()
        transactionTemplate.executeWithoutResult {
            jobRepository.findAllByStatusInAndDeadlineBefore(
                ExternalPluginContractJobStatus.AWAITING_PROVIDER, now, PageRequest.of(0, batchSize)
            ).forEach { candidate ->
                val job = jobRepository.findByIdForUpdate(candidate.id) ?: return@forEach
                if (job.status !in ExternalPluginContractJobStatus.AWAITING_PROVIDER || !job.deadline.isBefore(now)) {
                    return@forEach
                }
                val lastError = job.lastDeliveryError?.let { " (last delivery error: $it)" }.orEmpty()
                finish(job, EXPIRED, null, ContractErrorCodes.CONTRACT_JOB_EXPIRED,
                    "The provider did not answer before the deadline ${job.deadline}$lastError", now)
                logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} expired" }
            }
        }
    }

    fun deliverRequests() {
        due(setOf(PENDING)).forEach { job ->
            try {
                deliverRequest(job)
            } catch (e: Exception) {
                logger.warn(e) { "Delivering contract job ${job.id} failed unexpectedly" }
                retryRequest(job.id, "Delivery failed: ${e.message}")
            }
        }
    }

    fun deliverReplies() {
        due(ExternalPluginContractJobStatus.AWAITING_REPLY).forEach { job ->
            val error = try {
                if (job.replyToProcessInstanceId != null) correlateReply(job) else postReply(job)
            } catch (e: Exception) {
                "Reply delivery failed: ${e.message}"
            }
            if (error == null) markDelivered(job.id) else retryReply(job.id, error)
        }
    }

    fun purge() {
        val cutoff = clock.instant().minus(retention)
        val purged = transactionTemplate.execute {
            jobRepository.deleteAllByStatusInAndUpdatedAtBefore(ExternalPluginContractJobStatus.TERMINAL, cutoff)
        } ?: 0
        if (purged > 0) logger.info { "Purged $purged contract job(s) older than $retention" }
    }

    private fun deliverRequest(job: ExternalPluginContractJob) {
        val provider = contractService.loadProvider(job.providerConfigurationId)
        if (provider is ProviderLookup.Rejected) {
            // Unavailable and changed content can heal before the deadline; expiry reports it otherwise.
            retryRequest(job.id, "${provider.outcome.errorCode}: ${provider.outcome.errorMessage}")
            return
        }
        provider as ProviderLookup.Found
        val requester = configurationRepository.findById(job.requesterConfigurationId).orElse(null)
        val requesterDefinition = requester?.let { definitionRepository.findById(it.definitionId).orElse(null) }
        if (requester == null || requesterDefinition == null) {
            fail(job.id, ContractErrorCodes.CALLER_UNAVAILABLE, "The requesting configuration no longer exists")
            return
        }
        val operation = jobService.operationOf(job)
        if (operation == null) {
            fail(job.id, ContractErrorCodes.OPERATION_NOT_PROVIDED,
                "The provider no longer provides operation '${job.operation}' of contract '${job.contract}'")
            return
        }
        val target = ContractTarget(requester, requesterDefinition, provider.configuration, provider.definition, provider.host)
        val payload = jobService.decryptJson(job.requestPayload) ?: objectMapper.createObjectNode()
        val body = contractService.requestBody(target, payload, job.chainIds, job.id, job.deadline)

        val reply = contractService.interpret(contractService.deliver(target, job.contract, job.operation, body), operation, job = true)

        when (reply) {
            is ProviderReply.Completed -> complete(job.id, reply.result)
            is ProviderReply.Accepted -> transition(job.id, setOf(PENDING)) { locked, now ->
                locked.status = ACCEPTED
                locked.nextAttemptAt = null
                locked.lastDeliveryError = null
                locked.updatedAt = now
            }
            is ProviderReply.Failure -> if (reply.retryable) {
                retryRequest(job.id, "${reply.errorCode}: ${reply.errorMessage}")
            } else {
                fail(job.id, reply.errorCode, reply.errorMessage)
            }
        }
    }

    private fun complete(jobId: UUID, result: JsonNode?) {
        val json = result?.let { objectMapper.writeValueAsString(it) }
        transition(jobId, setOf(PENDING)) { job, now ->
            finish(job, COMPLETED, json, null, null, now)
        }
    }

    private fun fail(jobId: UUID, errorCode: String?, errorMessage: String) {
        transition(jobId, setOf(PENDING)) { job, now ->
            finish(job, FAILED, null, errorCode, errorMessage, now)
        }
        logger.info { "Contract job $jobId failed: $errorCode" }
    }

    private fun retryRequest(jobId: UUID, error: String) {
        transition(jobId, setOf(PENDING)) { job, now ->
            job.deliveryAttempts += 1
            job.nextAttemptAt = now.plus(backoff(job.deliveryAttempts))
            job.lastDeliveryError = error
            job.updatedAt = now
        }
    }

    /** Null on success, else the reason to retry. */
    private fun correlateReply(job: ExternalPluginContractJob): String? {
        val variables = mapOf(
            "jobId" to job.id.toString(),
            "status" to replyStatus(job.status),
            "result" to jobService.decryptJson(job.resultPayload)?.let { objectMapper.treeToValue(it, Any::class.java) },
            "errorCode" to job.errorCode,
            "errorMessage" to job.errorMessage,
        )
        val messageName = "contract-reply:${job.contract}:${job.operation}"
        transactionTemplate.executeWithoutResult {
            runWithoutAuthorization {
                correlationService.sendCatchEventMessage(messageName, job.replyToBusinessKey!!, variables)
            }
        }
        logger.info { "Correlated '$messageName' for contract job ${job.id} on business key ${job.replyToBusinessKey}" }
        return null
    }

    private fun postReply(job: ExternalPluginContractJob): String? {
        val requester = configurationRepository.findById(job.requesterConfigurationId).orElse(null)
            ?: return "The requesting configuration no longer exists"
        val definition = definitionRepository.findById(requester.definitionId).orElse(null)
            ?: return "The requesting configuration's plugin definition no longer exists"
        if (definition.isPlaceholder || definition.requiresReacceptance ||
            definition.status == ExternalPluginDefinitionStatus.UNAVAILABLE
        ) {
            return "The requesting plugin is not active (unavailable or awaiting re-acceptance)"
        }
        val host = hostRepository.findById(definition.hostId).orElse(null)
            ?: return "The requesting plugin's host is not registered"

        val body = objectMapper.createObjectNode().apply {
            put("configurationId", requester.id.toString())
            put("jobId", job.id.toString())
            put("contract", job.contract)
            put("operation", job.operation)
            put("status", replyStatus(job.status))
            jobService.decryptJson(job.resultPayload)?.let { set<JsonNode>("result", it) }
            job.errorCode?.let { put("errorCode", it) }
            job.errorMessage?.let { put("errorMessage", it) }
            put("requestedAt", job.createdAt.toString())
            job.completedAt?.let { put("completedAt", it.toString()) }
        }
        val response = hostClient.invokeContractReply(
            baseUrl = host.baseUrl,
            pluginId = definition.pluginId,
            version = definition.version,
            body = body,
            hostSecret = encryptionService.decrypt(host.secret),
        )
        val status = response.body?.get("status")?.textValue()
        if (response.status in 200..299 && status != ExternalPluginContractService.STATUS_ERROR) return null
        val detail = (response.body?.get("errorMessage") ?: response.body?.get("error") ?: response.body?.get("message"))
            ?.textValue()
        val code = response.body?.get("errorCode")?.textValue()
        return "Requester answered ${response.status}" + listOfNotNull(code, detail).joinToString(": ").let {
            if (it.isEmpty()) "" else " ($it)"
        }
    }

    private fun markDelivered(jobId: UUID) {
        transition(jobId, ExternalPluginContractJobStatus.AWAITING_REPLY) { job, now ->
            job.status = DELIVERED
            job.deliveredAt = now
            job.nextAttemptAt = null
            job.lastDeliveryError = null
            job.updatedAt = now
        }
    }

    private fun retryReply(jobId: UUID, error: String) {
        transition(jobId, ExternalPluginContractJobStatus.AWAITING_REPLY) { job, now ->
            job.deliveryAttempts += 1
            job.lastDeliveryError = error
            job.updatedAt = now
            if (job.deliveryAttempts >= maxReplyAttempts) {
                job.status = UNDELIVERABLE
                job.nextAttemptAt = null
                logger.warn {
                    "Contract job ${job.id} reply is undeliverable after ${job.deliveryAttempts} attempts: $error"
                }
            } else {
                job.nextAttemptAt = now.plus(backoff(job.deliveryAttempts))
            }
        }
    }

    private fun transition(
        jobId: UUID,
        expected: Set<ExternalPluginContractJobStatus>,
        change: (ExternalPluginContractJob, Instant) -> Unit,
    ) {
        transactionTemplate.executeWithoutResult {
            val job = jobRepository.findByIdForUpdate(jobId) ?: return@executeWithoutResult
            if (job.status !in expected) return@executeWithoutResult
            change(job, clock.instant())
            jobRepository.save(job)
        }
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
        job.deliveryAttempts = 0
        job.nextAttemptAt = now
        job.lastDeliveryError = null
        jobRepository.save(job)
    }

    private fun due(statuses: Set<ExternalPluginContractJobStatus>): List<ExternalPluginContractJob> =
        transactionTemplate.execute {
            jobRepository.findAllByStatusInAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                statuses, clock.instant(), PageRequest.of(0, batchSize)
            )
        }.orEmpty()

    /** `retryBase · 2^(attempts-1)`, capped at `retryMax`. */
    fun backoff(attempts: Int): Duration {
        val exponent = (attempts - 1).coerceIn(0, 30)
        val delay = retryBase.multipliedBy(1L shl exponent)
        return if (delay > retryMax || delay.isNegative) retryMax else delay
    }

    private fun replyStatus(status: ExternalPluginContractJobStatus): String = when (status) {
        COMPLETED -> "completed"
        EXPIRED -> "expired"
        else -> "failed"
    }

    private fun step(name: String, action: () -> Unit) {
        try {
            action()
        } catch (e: Exception) {
            logger.warn(e) { "Contract job dispatcher could not $name" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
