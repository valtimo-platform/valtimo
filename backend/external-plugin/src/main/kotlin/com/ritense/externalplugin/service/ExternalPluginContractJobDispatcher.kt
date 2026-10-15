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
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.ACCEPTED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.COMPLETED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.DELIVERED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.EXPIRED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.FAILED
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.PENDING
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus.UNDELIVERABLE
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginContractService.ContractTarget
import com.ritense.externalplugin.service.ExternalPluginContractService.ProviderLookup
import com.ritense.externalplugin.service.ExternalPluginContractService.ProviderReply
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.RuntimeService
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
    private val runtimeService: RuntimeService,
    private val retryBase: Duration,
    private val retryMax: Duration,
    private val maxReplyAttempts: Int,
    private val retention: Duration,
    private val batchSize: Int,
    private val clock: Clock = Clock.systemUTC(),
) {

    fun dispatch() {
        val run = Run()
        step("expire overdue jobs") { expireOverdue() }
        step("deliver requests") { deliverRequests(run) }
        step("deliver replies") { deliverReplies(run) }
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
                jobService.finish(job, EXPIRED, null, ContractErrorCodes.CONTRACT_JOB_EXPIRED,
                    "The provider did not answer before the deadline ${job.deadline}$lastError", now)
                logger.info { "Contract job ${job.id} ${job.contract}/${job.operation} expired" }
            }
        }
    }

    fun deliverRequests() = deliverRequests(Run())

    fun deliverReplies() = deliverReplies(Run())

    fun purge() {
        val cutoff = clock.instant().minus(retention)
        val purged = transactionTemplate.execute {
            jobRepository.deleteAllByStatusInAndUpdatedAtBefore(ExternalPluginContractJobStatus.TERMINAL, cutoff)
        } ?: 0
        if (purged > 0) logger.info { "Purged $purged contract job(s) older than $retention" }
    }

    private fun deliverRequests(run: Run) {
        due(setOf(PENDING)).forEach { job ->
            try {
                deliverRequest(job, run)
            } catch (e: Exception) {
                logger.warn(e) { "Delivering contract job ${job.id} failed unexpectedly" }
                retryRequest(job.id, "Delivery failed: ${e.message}")
            }
        }
    }

    private fun deliverReplies(run: Run) {
        due(ExternalPluginContractJobStatus.AWAITING_REPLY).forEach { job ->
            try {
                deliverReply(job, run)
            } catch (e: Exception) {
                logger.warn(e) { "Delivering the reply of contract job ${job.id} failed unexpectedly" }
                retryReply(job.id, "Reply delivery failed: ${e.message}")
            }
        }
    }

    private fun deliverRequest(job: ExternalPluginContractJob, run: Run) {
        val provider = contractService.loadProvider(job.providerConfigurationId)
        if (provider is ProviderLookup.Rejected) {
            // Unavailable and changed content can heal before the deadline; expiry reports it otherwise.
            retryRequest(job.id, "${provider.outcome.errorCode}: ${provider.outcome.errorMessage}")
            return
        }
        provider as ProviderLookup.Found
        if (provider.host.id in run.unreachableHosts) {
            postpone(job.id, setOf(PENDING))
            return
        }
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
        val body = contractService.requestBody(
            target, payload, job.chainIds, job.id, job.deadline, job.documentId, job.requestedBy,
        )

        val response = contractService.deliver(target, job.contract, job.operation, body, correlationId = job.id.toString())
        when (val reply = contractService.interpret(response, operation, job = true)) {
            is ProviderReply.Completed -> complete(job.id, reply.result)
            is ProviderReply.Accepted -> transition(job.id, setOf(PENDING)) { locked, now ->
                locked.status = ACCEPTED
                locked.nextAttemptAt = null
                locked.lastDeliveryError = null
                locked.updatedAt = now
            }
            is ProviderReply.Failure -> if (reply.retryable) {
                if (reply.errorCode == ContractErrorCodes.PROVIDER_UNREACHABLE) run.unreachableHosts += provider.host.id
                retryRequest(job.id, "${reply.errorCode}: ${reply.errorMessage}")
            } else {
                fail(job.id, reply.errorCode, reply.errorMessage, reply.providerErrorCode)
            }
        }
    }

    private fun deliverReply(job: ExternalPluginContractJob, run: Run) {
        if (job.replyToProcessInstanceId != null) {
            record(job.id, correlateReply(job))
            return
        }
        val target = when (val resolved = replyTarget(job)) {
            is ReplyTarget.Unusable -> {
                record(job.id, resolved.attempt)
                return
            }
            is ReplyTarget.Found -> resolved
        }
        if (target.host.id in run.unreachableHosts) {
            postpone(job.id, ExternalPluginContractJobStatus.AWAITING_REPLY)
            return
        }
        val attempt = postReply(job, target)
        if (attempt is ReplyAttempt.Failed && attempt.transport) run.unreachableHosts += target.host.id
        record(job.id, attempt)
    }

    private fun record(jobId: UUID, attempt: ReplyAttempt) = when (attempt) {
        ReplyAttempt.Delivered -> markDelivered(jobId)
        is ReplyAttempt.Failed -> retryReply(jobId, attempt.error)
        is ReplyAttempt.Deferred -> deferReply(jobId, attempt.reason)
    }

    private fun complete(jobId: UUID, result: JsonNode?) {
        val json = result?.let { objectMapper.writeValueAsString(it) }
        transition(jobId, setOf(PENDING)) { job, now ->
            jobService.finish(job, COMPLETED, json, null, null, now)
        }
    }

    private fun fail(jobId: UUID, errorCode: String, errorMessage: String, providerErrorCode: String? = null) {
        transition(jobId, setOf(PENDING)) { job, now ->
            jobService.finish(job, FAILED, null, errorCode, errorMessage, now, providerErrorCode)
        }
        logger.info { "Contract job $jobId failed: $errorCode" }
    }

    private fun retryRequest(jobId: UUID, error: String) {
        transition(jobId, setOf(PENDING)) { job, now ->
            job.deliveryAttempts += 1
            job.nextAttemptAt = now.plus(backoff(job.deliveryAttempts))
            job.lastDeliveryError = ContractLimits.errorMessage(error)
            job.updatedAt = now
        }
    }

    /**
     * The reply goes to the stored process instance only. A catch event waiting for
     * `contract-reply:<jobId>` takes precedence over the generic `contract-reply:<contract>:<operation>`;
     * exactly one execution must wait for the chosen name.
     */
    private fun correlateReply(job: ExternalPluginContractJob): ReplyAttempt {
        val processInstanceId = job.replyToProcessInstanceId!!
        val reply = linkedMapOf(
            "jobId" to job.id.toString(),
            "contract" to job.contract,
            "operation" to job.operation,
            "status" to replyStatus(job),
            "result" to jobService.decryptJson(job.resultPayload)?.let { objectMapper.treeToValue(it, Any::class.java) },
            "errorCode" to job.errorCode,
            "providerErrorCode" to job.providerErrorCode,
            "errorMessage" to job.errorMessage,
        ).filterValues { it != null }
        val jobMessage = "$REPLY_MESSAGE_PREFIX${job.id}"
        var correlated: String? = null
        val error = transactionTemplate.execute {
            runWithoutAuthorization {
                val messageName = if (waitingExecutions(processInstanceId, jobMessage) > 0) {
                    jobMessage
                } else {
                    "$REPLY_MESSAGE_PREFIX${job.contract}:${job.operation}"
                }
                val waiting = waitingExecutions(processInstanceId, messageName)
                when {
                    waiting == 0L -> "No execution of process instance $processInstanceId waits for message '$messageName'"
                    waiting > 1L -> "Several executions of process instance $processInstanceId wait for '$messageName'; " +
                        "name each catch event's message '$REPLY_MESSAGE_PREFIX\${<variable holding the job id>}' to tell them apart"
                    else -> {
                        runtimeService.createMessageCorrelation(messageName)
                            .processInstanceId(processInstanceId)
                            .setVariablesLocal(mapOf(REPLY_VARIABLE to reply))
                            .correlateWithResult()
                        correlated = messageName
                        null
                    }
                }
            }
        }
        if (error != null) return ReplyAttempt.Failed(error)
        logger.info { "Correlated '$correlated' for contract job ${job.id} on process instance $processInstanceId" }
        return ReplyAttempt.Delivered
    }

    private fun waitingExecutions(processInstanceId: String, messageName: String): Long =
        runtimeService.createEventSubscriptionQuery()
            .processInstanceId(processInstanceId)
            .eventType(MESSAGE_EVENT_TYPE)
            .eventName(messageName)
            .count()

    private fun replyTarget(job: ExternalPluginContractJob): ReplyTarget {
        val requester = configurationRepository.findById(job.requesterConfigurationId).orElse(null)
            ?: return ReplyTarget.Unusable(ReplyAttempt.Failed("The requesting configuration no longer exists"))
        val definition = definitionRepository.findById(requester.definitionId).orElse(null)
            ?: return ReplyTarget.Unusable(ReplyAttempt.Failed("The requesting configuration's plugin definition no longer exists"))
        if (definition.isPlaceholder || definition.requiresReacceptance ||
            definition.status == ExternalPluginDefinitionStatus.UNAVAILABLE
        ) {
            return ReplyTarget.Unusable(
                ReplyAttempt.Deferred("The requesting plugin is not active (unavailable or awaiting re-acceptance)")
            )
        }
        val host = hostRepository.findById(definition.hostId).orElse(null)
            ?: return ReplyTarget.Unusable(ReplyAttempt.Failed("The requesting plugin's host is not registered"))
        return ReplyTarget.Found(requester, definition, host)
    }

    private fun postReply(job: ExternalPluginContractJob, target: ReplyTarget.Found): ReplyAttempt {
        val body = objectMapper.createObjectNode().apply {
            put("configurationId", target.requester.id.toString())
            put("jobId", job.id.toString())
            put("contract", job.contract)
            put("operation", job.operation)
            put("status", replyStatus(job))
            jobService.decryptJson(job.resultPayload)?.let { set<JsonNode>("result", it) }
            job.errorCode?.let { put("errorCode", it) }
            job.providerErrorCode?.let { put("providerErrorCode", it) }
            job.errorMessage?.let { put("errorMessage", it) }
            put("requestedAt", job.createdAt.toString())
            job.completedAt?.let { put("completedAt", it.toString()) }
        }
        val response = hostClient.invokeContractReply(
            baseUrl = target.host.baseUrl,
            pluginId = target.definition.pluginId,
            version = target.definition.version,
            body = body,
            hostSecret = encryptionService.decrypt(target.host.secret),
            correlationId = job.id.toString(),
        )
        val status = response.body?.get("status")?.textValue()
        if (response.status in 200..299 && status != ExternalPluginContractService.STATUS_ERROR) {
            if (status == STATUS_IGNORED) {
                logger.warn {
                    "Contract job ${job.id} reply was acknowledged without a reply handler by " +
                        "'${target.definition.pluginId}@${target.definition.version}' (configuration ${target.requester.id})"
                }
            }
            return ReplyAttempt.Delivered
        }
        val detail = (response.body?.get("errorMessage") ?: response.body?.get("error") ?: response.body?.get("message"))
            ?.textValue()
        val code = response.body?.get("errorCode")?.textValue()
        val error = "Requester answered ${response.status}" + listOfNotNull(code, detail).joinToString(": ").let {
            if (it.isEmpty()) "" else " ($it)"
        }
        val transport = code == ExternalPluginHostClient.HOST_UNREACHABLE_ERROR_CODE ||
            response.status in ExternalPluginContractService.TRANSPORT_FAILURE_STATUSES
        return ReplyAttempt.Failed(error, transport)
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
            job.lastDeliveryError = ContractLimits.errorMessage(error)
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

    /** The requester cannot take replies at the moment; waiting for it is not a failed attempt. */
    private fun deferReply(jobId: UUID, reason: String) {
        transition(jobId, ExternalPluginContractJobStatus.AWAITING_REPLY) { job, now ->
            job.nextAttemptAt = now.plus(retryMax)
            job.lastDeliveryError = ContractLimits.errorMessage(reason)
            job.updatedAt = now
        }
    }

    /** A host already unreachable in this run: try again next run, without spending an attempt. */
    private fun postpone(jobId: UUID, expected: Set<ExternalPluginContractJobStatus>) {
        transition(jobId, expected) { job, now ->
            job.nextAttemptAt = now.plus(retryBase)
            job.updatedAt = now
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

    private fun replyStatus(job: ExternalPluginContractJob): String = when (job.outcome ?: job.status) {
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

    /** Hosts that failed at transport level during one dispatcher run. */
    private class Run {
        val unreachableHosts = mutableSetOf<UUID>()
    }

    private sealed interface ReplyAttempt {
        data object Delivered : ReplyAttempt
        data class Failed(val error: String, val transport: Boolean = false) : ReplyAttempt
        data class Deferred(val reason: String) : ReplyAttempt
    }

    private sealed interface ReplyTarget {
        data class Found(
            val requester: ExternalPluginConfiguration,
            val definition: ExternalPluginDefinition,
            val host: ExternalPluginHost,
        ) : ReplyTarget

        data class Unusable(val attempt: ReplyAttempt) : ReplyTarget
    }

    companion object {
        const val REPLY_VARIABLE = "contractReply"
        const val REPLY_MESSAGE_PREFIX = "contract-reply:"
        private const val MESSAGE_EVENT_TYPE = "message"
        private const val STATUS_IGNORED = "ignored"
        private val logger = KotlinLogging.logger {}
    }
}
