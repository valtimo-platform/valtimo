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
import com.fasterxml.jackson.databind.node.NullNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SpecVersion
import com.networknt.schema.resource.DisallowSchemaLoader
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.client.ExternalPluginHostClient.ActionResponse
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginManifestContracts
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractBindingRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore

/**
 * Brokers contract calls between configurations: resolves the caller's binding, applies every guard,
 * delivers to the provider's host and maps the answer onto a structured outcome. GZAC stamps the
 * `caller` from the token, so a provider can never be lied to about who is calling.
 *
 * No transactions here: lookups are single repository reads and the host call must never pin one.
 */
@SkipComponentScan
class ExternalPluginContractService(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val hostRepository: ExternalPluginHostRepository,
    private val contractBindingRepository: ExternalPluginContractBindingRepository,
    private val hostClient: ExternalPluginHostClient,
    private val encryptionService: EncryptionService,
    private val objectMapper: ObjectMapper,
    private val maxDepth: Int,
    private val maxPayloadBytes: Int,
    /** Bounds a synchronous call's deadline; matches the contract RestTemplate's read timeout. */
    private val readTimeout: Duration,
    /** Synchronous calls in flight per calling configuration on this node. */
    private val maxConcurrentCalls: Int,
    private val clock: Clock = Clock.systemUTC(),
) {

    private val callPermits = ConcurrentHashMap<UUID, Semaphore>()

    /**
     * Synchronous call (`POST /call`). Never throws for a provider-side failure.
     *
     * The time budget travels as a relative timeout, never as an instant, so clock skew between GZAC
     * and the hosts cannot shrink or void it.
     *
     * @throws IllegalArgumentException for a malformed chain or timeout header (a 400, not an outcome).
     */
    fun call(
        callerConfigurationId: UUID,
        contract: String,
        operation: String,
        payload: JsonNode?,
        chainHeader: String?,
        timeoutHeader: String?,
        correlationIdHeader: String?,
    ): ContractOutcome {
        val startedAt = System.nanoTime()
        val correlationId = correlationIdOf(correlationIdHeader)
        val requestedTimeoutMs = parseTimeoutMs(timeoutHeader)
        if (requestedTimeoutMs == 0L) {
            val outcome = ContractOutcome.error(
                ContractErrorCodes.CONTRACT_DEADLINE_EXCEEDED,
                "The caller has no time left for this call",
            )
            auditRefusal(correlationId, callerConfigurationId, contract, operation, outcome, startedAt)
            return outcome
        }
        val deadline = clock.instant().plusMillis(minOf(requestedTimeoutMs ?: Long.MAX_VALUE, readTimeout.toMillis()))

        val permits = callPermits.computeIfAbsent(callerConfigurationId) { Semaphore(maxConcurrentCalls) }
        if (!permits.tryAcquire()) {
            val outcome = ContractOutcome.error(
                ContractErrorCodes.TOO_MANY_CONCURRENT_CALLS,
                "The calling configuration already has $maxConcurrentCalls contract calls in progress",
            )
            auditRefusal(correlationId, callerConfigurationId, contract, operation, outcome, startedAt)
            return outcome
        }
        try {
            val resolution = resolve(callerConfigurationId, contract, operation, payload, chainHeader, synchronous = true)
            val remainingMs = Duration.between(clock.instant(), deadline).toMillis()
            val outcome = when {
                resolution is Resolution.Rejected -> resolution.outcome
                remainingMs <= 0 -> ContractOutcome.error(
                    ContractErrorCodes.CONTRACT_DEADLINE_EXCEEDED,
                    "The caller's time ran out before the call could be delivered",
                )
                else -> {
                    resolution as Resolution.Resolved
                    val reply = deliver(
                        resolution.target,
                        contract,
                        operation,
                        requestBody(resolution, timeoutMs = remainingMs),
                        correlationId,
                    )
                    when (val interpreted = interpret(reply, resolution.operation, job = false)) {
                        is ProviderReply.Completed -> ContractOutcome.completed(interpreted.result)
                        is ProviderReply.Accepted -> ContractOutcome.error(
                            ContractErrorCodes.PROVIDER_INVALID_RESULT,
                            "Provider answered 'accepted' to a synchronous call",
                        )
                        is ProviderReply.Failure -> ContractOutcome.error(
                            interpreted.errorCode,
                            interpreted.errorMessage,
                            interpreted.providerErrorCode,
                        )
                    }
                }
            }
            audit(correlationId, "call", callerConfigurationId, resolution, contract, operation, outcome, startedAt)
            return outcome
        } finally {
            permits.release()
        }
    }

    /**
     * Binding resolution plus all guards. [synchronous] rejects `job` operations — they may outlive
     * the caller's host-call timeout. A job request accepts both modes.
     *
     * @throws IllegalArgumentException for a malformed chain header (a 400, not an outcome).
     */
    fun resolve(
        callerConfigurationId: UUID,
        contract: String,
        operation: String,
        payload: JsonNode?,
        chainHeader: String?,
        synchronous: Boolean,
    ): Resolution {
        val receivedChain = parseChain(chainHeader)
        val caller = configurationRepository.findById(callerConfigurationId).orElse(null)
        val callerDefinition = caller?.let { definitionRepository.findById(it.definitionId).orElse(null) }
        if (caller == null || callerDefinition == null || !isRunnable(callerDefinition)) {
            return reject(ContractErrorCodes.CALLER_UNAVAILABLE, "The calling configuration is not active")
        }

        val payloadNode = payload ?: objectMapper.createObjectNode()
        val payloadSize = objectMapper.writeValueAsBytes(payloadNode).size
        if (payloadSize > maxPayloadBytes) {
            return reject(
                ContractErrorCodes.PAYLOAD_TOO_LARGE,
                "Payload is $payloadSize bytes; the maximum is $maxPayloadBytes",
            )
        }

        val declaredOperations = ExternalPluginManifestContracts.declaredOperations(callerDefinition.manifestJson, contract)
        if (declaredOperations != null && operation !in declaredOperations) {
            return reject(
                ContractErrorCodes.OPERATION_NOT_DECLARED,
                "'${callerDefinition.pluginId}@${callerDefinition.version}' declares operations $declaredOperations " +
                    "of '$contract', not '$operation'",
            )
        }

        val binding = contractBindingRepository.findByConfigurationIdAndContract(callerConfigurationId, contract)
            ?: return reject(
                ContractErrorCodes.NO_PROVIDER_BOUND,
                "No provider is bound for contract '$contract' on this configuration",
            )

        val chain = (if (receivedChain.lastOrNull() == caller.id) receivedChain else receivedChain + caller.id)
        if (binding.targetConfigurationId in chain) {
            return reject(ContractErrorCodes.CONTRACT_CYCLE, "The bound provider is already part of this call chain")
        }
        if (chain.size > maxDepth) {
            return reject(
                ContractErrorCodes.CONTRACT_DEPTH_EXCEEDED,
                "Contract call chain exceeds the maximum depth of $maxDepth",
            )
        }

        val target = when (val loaded = loadProvider(binding.targetConfigurationId)) {
            is ProviderLookup.Rejected -> return Resolution.Rejected(loaded.outcome)
            is ProviderLookup.Found -> ContractTarget(
                caller = caller,
                callerDefinition = callerDefinition,
                provider = loaded.configuration,
                providerDefinition = loaded.definition,
                host = loaded.host,
            )
        }

        val providedOperation = ExternalPluginManifestContracts.findOperation(
            target.providerDefinition.manifestJson, contract, operation
        ) ?: return Resolution.Rejected(
            ContractOutcome.error(
                ContractErrorCodes.OPERATION_NOT_PROVIDED,
                "'${target.providerDefinition.pluginId}@${target.providerDefinition.version}' does not provide " +
                    "operation '$operation' of contract '$contract'",
            ),
            target,
        )
        if (synchronous && providedOperation.isJob) {
            return Resolution.Rejected(
                ContractOutcome.error(
                    ContractErrorCodes.OPERATION_REQUIRES_JOB,
                    "Operation '$operation' of contract '$contract' is long-running; request it as a job",
                ),
                target,
            )
        }
        providedOperation.input?.let { schema -> schemaViolation(providedOperation, INPUT, schema, payloadNode) }?.let {
            return Resolution.Rejected(ContractOutcome.error(ContractErrorCodes.CONTRACT_INPUT_INVALID, it), target)
        }
        return Resolution.Resolved(target, contract, providedOperation, payloadNode, chain)
    }

    /** Re-checks a provider before a (retried) job delivery; the binding may have changed meanwhile. */
    fun loadProvider(providerConfigurationId: UUID): ProviderLookup {
        val provider = configurationRepository.findById(providerConfigurationId).orElse(null)
        val definition = provider?.let { definitionRepository.findById(it.definitionId).orElse(null) }
        if (provider == null || definition == null || definition.isPlaceholder ||
            definition.status == ExternalPluginDefinitionStatus.UNAVAILABLE
        ) {
            return ProviderLookup.Rejected(
                ContractOutcome.error(ContractErrorCodes.PROVIDER_UNAVAILABLE, "The bound provider is not available")
            )
        }
        if (definition.requiresReacceptance) {
            return ProviderLookup.Rejected(
                ContractOutcome.error(
                    ContractErrorCodes.PROVIDER_CONTENT_CHANGED,
                    "The bound provider changed on its host and awaits re-acceptance by an administrator",
                )
            )
        }
        val host = hostRepository.findById(definition.hostId).orElse(null)
            ?: return ProviderLookup.Rejected(
                ContractOutcome.error(ContractErrorCodes.PROVIDER_UNAVAILABLE, "The bound provider's host is not registered")
            )
        return ProviderLookup.Found(provider, definition, host)
    }

    /** A synchronous delivery: [timeoutMs] is what is left of the caller's budget. */
    fun requestBody(resolution: Resolution.Resolved, timeoutMs: Long): ObjectNode =
        requestBody(resolution.target, resolution.payload, resolution.chain, jobId = null, deadline = null, timeoutMs = timeoutMs)

    /** [deadline], [documentId] and [requestedBy] travel with jobs, [timeoutMs] with synchronous calls. */
    fun requestBody(
        target: ContractTarget,
        payload: JsonNode,
        chain: List<UUID>,
        jobId: UUID?,
        deadline: Instant?,
        documentId: String? = null,
        requestedBy: String? = null,
        timeoutMs: Long? = null,
    ): ObjectNode = objectMapper.createObjectNode().apply {
        put("configurationId", target.provider.id.toString())
        putObject("caller").apply {
            put("pluginId", target.callerDefinition.pluginId)
            put("version", target.callerDefinition.version)
            put("configurationId", target.caller.id.toString())
        }
        set<JsonNode>("payload", payload)
        if (jobId != null) put("jobId", jobId.toString())
        if (deadline != null) put("deadline", deadline.toString())
        if (timeoutMs != null) put("timeoutMs", timeoutMs)
        if (jobId != null && documentId != null) put("documentId", documentId)
        if (jobId != null && requestedBy != null) put("requestedBy", requestedBy)
        putArray("chain").apply { chain.forEach { add(it.toString()) } }
    }

    fun deliver(
        target: ContractTarget,
        contract: String,
        operation: String,
        body: ObjectNode,
        correlationId: String?,
    ): ActionResponse =
        hostClient.invokeContract(
            baseUrl = target.host.baseUrl,
            pluginId = target.providerDefinition.pluginId,
            version = target.providerDefinition.version,
            contract = contract,
            operation = operation,
            body = body,
            hostSecret = encryptionService.decrypt(target.host.secret),
            correlationId = correlationId,
        )

    /**
     * Maps the provider host's answer. [ProviderReply.Failure.retryable] marks transport-level
     * failures a job delivery retries; a synchronous call reports them as-is.
     */
    fun interpret(
        response: ActionResponse,
        operation: ExternalPluginManifestContracts.Operation,
        job: Boolean,
    ): ProviderReply {
        val body = response.body
        val hostCode = body?.get("errorCode")?.textValue()?.takeIf { it.isNotBlank() }
        val hostMessage = (body?.get("errorMessage") ?: body?.get("error") ?: body?.get("message"))?.textValue()
        val status = response.status
        return when {
            status in 200..299 -> interpretAnswer(body, operation, job)
            hostCode == ExternalPluginHostClient.HOST_UNREACHABLE_ERROR_CODE || status in TRANSPORT_FAILURE_STATUSES ->
                ProviderReply.Failure(
                    ContractErrorCodes.PROVIDER_UNREACHABLE,
                    hostMessage ?: "The provider's host is unreachable",
                    retryable = true,
                )
            status == 409 -> ProviderReply.Failure(
                ContractErrorCodes.PROVIDER_CONTENT_CHANGED,
                hostMessage ?: "The provider's host refused: its package no longer matches the accepted content",
                retryable = true,
            )
            status == 404 && hostCode == HOST_OPERATION_NOT_PROVIDED -> ProviderReply.Failure(
                ContractErrorCodes.OPERATION_NOT_PROVIDED,
                hostMessage ?: "The provider does not provide this operation",
            )
            status == 404 && hostCode in HOST_PROVIDER_NOT_READY -> ProviderReply.Failure(
                ContractErrorCodes.PROVIDER_UNAVAILABLE,
                withCode(hostCode, hostMessage ?: "The provider is not loaded on its host"),
                retryable = true,
            )
            // A host or app without the contract route answers a bare 404.
            (status == 404 && hostCode == null) || status == 501 -> ProviderReply.Failure(
                ContractErrorCodes.PROVIDER_UNSUPPORTED,
                withCode(hostCode, hostMessage ?: "The provider's host does not support contract calls"),
            )
            status >= 500 -> ProviderReply.Failure(
                ContractErrorCodes.PROVIDER_ERROR,
                withCode(hostCode, hostMessage ?: "The provider's host failed with status $status"),
                retryable = true,
            )
            else -> ProviderReply.Failure(
                ContractErrorCodes.PROVIDER_ERROR,
                withCode(hostCode, hostMessage ?: "The provider's host answered status $status"),
            )
        }
    }

    private fun interpretAnswer(
        body: JsonNode?,
        operation: ExternalPluginManifestContracts.Operation,
        job: Boolean,
    ): ProviderReply = when (body?.get("status")?.textValue()) {
        STATUS_COMPLETED -> {
            val result = body.get("result")
            resultViolation(operation, result)
                ?.let { ProviderReply.Failure(ContractErrorCodes.PROVIDER_INVALID_RESULT, it) }
                ?: ProviderReply.Completed(result)
        }
        STATUS_ACCEPTED -> if (job) {
            ProviderReply.Accepted
        } else {
            ProviderReply.Failure(ContractErrorCodes.PROVIDER_INVALID_RESULT, "Provider answered 'accepted' to a synchronous call")
        }
        STATUS_ERROR -> ProviderReply.Failure(
            ContractErrorCodes.PROVIDER_ERROR,
            body.get("errorMessage")?.textValue() ?: "The provider reported an error",
            providerErrorCode = body.get("errorCode")?.textValue()?.takeIf { it.isNotBlank() },
        )
        else -> ProviderReply.Failure(
            ContractErrorCodes.PROVIDER_INVALID_RESULT,
            "Provider answered without a valid status",
        )
    }

    /**
     * Why a completed [result] is unacceptable — size, declared `outputs`, then the `output` schema —
     * or null when it passes. Without an [operation] only the size is checked.
     */
    fun resultViolation(operation: ExternalPluginManifestContracts.Operation?, result: JsonNode?): String? {
        if (result != null) {
            val size = objectMapper.writeValueAsBytes(result).size
            if (size > maxPayloadBytes) return "Result is $size bytes; the maximum is $maxPayloadBytes"
        }
        if (operation == null) return null
        val missing = missingOutputs(operation, result)
        if (missing.isNotEmpty()) {
            return "Operation '${operation.key}' declares outputs ${operation.outputs}, but the result is missing $missing"
        }
        return operation.output?.let { schema -> schemaViolation(operation, OUTPUT, schema, result ?: NullNode.instance) }
    }

    /** JSON null is a valid output value; only an absent key violates the declaration. */
    fun missingOutputs(operation: ExternalPluginManifestContracts.Operation, result: JsonNode?): List<String> {
        if (operation.outputs.isEmpty()) return emptyList()
        if (result == null || !result.isObject) return operation.outputs
        return operation.outputs.filterNot { result.has(it) }
    }

    /** Valid `X-Valtimo-Correlation-Id` values are reused; anything else gets a fresh id. */
    fun correlationIdOf(header: String?): String =
        header?.takeIf { CORRELATION_ID_PATTERN.matches(it) } ?: UUID.randomUUID().toString()

    fun audit(
        correlationId: String,
        kind: String,
        callerConfigurationId: UUID,
        resolution: Resolution,
        contract: String,
        operation: String,
        outcome: ContractOutcome,
        startedAtNanos: Long,
    ) {
        val target = when (resolution) {
            is Resolution.Resolved -> resolution.target
            is Resolution.Rejected -> resolution.target
        }
        val caller = target?.let { "${it.callerDefinition.pluginId}(${it.caller.id})" } ?: "($callerConfigurationId)"
        val callee = target?.let { "${it.providerDefinition.pluginId}(${it.provider.id})" } ?: "(unresolved)"
        val durationMs = (System.nanoTime() - startedAtNanos) / 1_000_000
        logger.info {
            "Contract $kind $correlationId: $caller -> $callee $contract/$operation " +
                "${outcome.status}${outcome.errorCode?.let { " [$it]" } ?: ""}" +
                "${outcome.jobId?.let { " job $it" } ?: ""} in ${durationMs}ms"
        }
    }

    private fun auditRefusal(
        correlationId: String,
        callerConfigurationId: UUID,
        contract: String,
        operation: String,
        outcome: ContractOutcome,
        startedAtNanos: Long,
    ) = audit(
        correlationId, "call", callerConfigurationId, Resolution.Rejected(outcome), contract, operation, outcome, startedAtNanos,
    )

    private fun schemaViolation(
        operation: ExternalPluginManifestContracts.Operation,
        kind: String,
        schema: JsonNode,
        value: JsonNode,
    ): String? {
        val messages = try {
            require(schema.isObject) { "the schema must be a JSON object" }
            SCHEMA_FACTORY.getSchema(schema).validate(value).map { it.message }
        } catch (e: Exception) {
            return "Operation '${operation.key}' declares an invalid $kind schema: ${e.message ?: e.javaClass.simpleName}"
        }
        if (messages.isEmpty()) return null
        val subject = if (kind == INPUT) "Payload" else "Result"
        return "$subject does not match the $kind schema of operation '${operation.key}': " +
            messages.take(MAX_SCHEMA_MESSAGES).joinToString("; ")
    }

    private fun isRunnable(definition: ExternalPluginDefinition): Boolean =
        !definition.isPlaceholder &&
            !definition.requiresReacceptance &&
            definition.status != ExternalPluginDefinitionStatus.UNAVAILABLE

    private fun parseChain(header: String?): List<UUID> {
        if (header.isNullOrBlank()) return emptyList()
        return header.split(',').map { it.trim() }.filter { it.isNotEmpty() }.map {
            try {
                UUID.fromString(it)
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("Malformed $CHAIN_HEADER header: '$it' is not a configuration id")
            }
        }
    }

    private fun parseTimeoutMs(header: String?): Long? {
        if (header.isNullOrBlank()) return null
        val value = header.trim()
        require(TIMEOUT_MS_PATTERN.matches(value)) {
            "Malformed $TIMEOUT_HEADER header: '$header' is not a whole number of milliseconds"
        }
        return value.toLong()
    }

    private fun withCode(code: String?, message: String): String = if (code.isNullOrBlank()) message else "$code: $message"

    private fun reject(errorCode: String, message: String) = Resolution.Rejected(ContractOutcome.error(errorCode, message))

    data class ContractTarget(
        val caller: ExternalPluginConfiguration,
        val callerDefinition: ExternalPluginDefinition,
        val provider: ExternalPluginConfiguration,
        val providerDefinition: ExternalPluginDefinition,
        val host: ExternalPluginHost,
    )

    sealed interface Resolution {
        data class Resolved(
            val target: ContractTarget,
            val contract: String,
            val operation: ExternalPluginManifestContracts.Operation,
            val payload: JsonNode,
            val chain: List<UUID>,
        ) : Resolution

        data class Rejected(val outcome: ContractOutcome, val target: ContractTarget? = null) : Resolution
    }

    sealed interface ProviderLookup {
        data class Found(
            val configuration: ExternalPluginConfiguration,
            val definition: ExternalPluginDefinition,
            val host: ExternalPluginHost,
        ) : ProviderLookup

        data class Rejected(val outcome: ContractOutcome) : ProviderLookup
    }

    sealed interface ProviderReply {
        data class Completed(val result: JsonNode?) : ProviderReply
        data object Accepted : ProviderReply
        data class Failure(
            val errorCode: String,
            val errorMessage: String,
            val retryable: Boolean = false,
            /** The provider's own code; host-level codes stay in [errorMessage]. */
            val providerErrorCode: String? = null,
        ) : ProviderReply
    }

    companion object {
        const val CHAIN_HEADER = "X-Valtimo-Contract-Chain"
        /** Milliseconds the caller still waits for the answer. */
        const val TIMEOUT_HEADER = "X-Valtimo-Contract-Timeout-Ms"
        const val CORRELATION_ID_HEADER = ExternalPluginHostClient.CORRELATION_ID_HEADER
        const val STATUS_COMPLETED = "completed"
        const val STATUS_ACCEPTED = "accepted"
        const val STATUS_ERROR = "error"
        private const val HOST_OPERATION_NOT_PROVIDED = "CONTRACT_OPERATION_NOT_PROVIDED"
        private val HOST_PROVIDER_NOT_READY = setOf("PLUGIN_NOT_LOADED", "CONFIGURATION_NOT_FOUND")
        val TRANSPORT_FAILURE_STATUSES = setOf(502, 503, 504)
        private val CORRELATION_ID_PATTERN = Regex("^[A-Za-z0-9-]{1,64}$")
        private val TIMEOUT_MS_PATTERN = Regex("^[0-9]{1,12}$")
        private const val INPUT = "input"
        private const val OUTPUT = "output"
        private const val MAX_SCHEMA_MESSAGES = 5

        // Remote `$ref`s are refused: a provider manifest must not make GZAC fetch arbitrary URLs.
        private val SCHEMA_FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012) { builder ->
            builder.schemaLoaders { it.add(DisallowSchemaLoader.getInstance()) }
        }
        private val logger = KotlinLogging.logger {}
    }
}

data class ContractOutcome(
    val status: String,
    val result: JsonNode? = null,
    val jobId: UUID? = null,
    val errorCode: String? = null,
    val errorMessage: String? = null,
    val providerErrorCode: String? = null,
) {
    companion object {
        fun completed(result: JsonNode?) = ContractOutcome(ExternalPluginContractService.STATUS_COMPLETED, result = result)
        fun accepted(jobId: UUID) = ContractOutcome(ExternalPluginContractService.STATUS_ACCEPTED, jobId = jobId)
        fun error(errorCode: String, errorMessage: String, providerErrorCode: String? = null) = ContractOutcome(
            ExternalPluginContractService.STATUS_ERROR,
            errorCode = errorCode,
            errorMessage = ContractLimits.errorMessage(errorMessage),
            providerErrorCode = providerErrorCode?.let(ContractLimits::providerErrorCode),
        )
    }
}

/** Length caps for every stored or returned error text; the columns and the plugin SDK rely on them. */
object ContractLimits {
    const val MAX_ERROR_MESSAGE_LENGTH = 2000
    const val MAX_PROVIDER_ERROR_CODE_LENGTH = 255

    fun errorMessage(message: String): String = message.take(MAX_ERROR_MESSAGE_LENGTH)

    fun providerErrorCode(code: String): String = code.take(MAX_PROVIDER_ERROR_CODE_LENGTH)
}

object ContractErrorCodes {
    const val NO_PROVIDER_BOUND = "NO_PROVIDER_BOUND"
    const val PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    const val PROVIDER_CONTENT_CHANGED = "PROVIDER_CONTENT_CHANGED"
    const val PROVIDER_UNREACHABLE = "PROVIDER_UNREACHABLE"
    const val PROVIDER_UNSUPPORTED = "PROVIDER_UNSUPPORTED"
    const val PROVIDER_ERROR = "PROVIDER_ERROR"
    const val PROVIDER_INVALID_RESULT = "PROVIDER_INVALID_RESULT"
    const val OPERATION_NOT_PROVIDED = "OPERATION_NOT_PROVIDED"
    const val OPERATION_NOT_DECLARED = "OPERATION_NOT_DECLARED"
    const val OPERATION_REQUIRES_JOB = "OPERATION_REQUIRES_JOB"
    const val CONTRACT_INPUT_INVALID = "CONTRACT_INPUT_INVALID"
    const val CONTRACT_CYCLE = "CONTRACT_CYCLE"
    const val CONTRACT_DEPTH_EXCEEDED = "CONTRACT_DEPTH_EXCEEDED"
    const val CONTRACT_DEADLINE_EXCEEDED = "CONTRACT_DEADLINE_EXCEEDED"
    const val TOO_MANY_CONCURRENT_CALLS = "TOO_MANY_CONCURRENT_CALLS"
    const val PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    const val CALLER_UNAVAILABLE = "CALLER_UNAVAILABLE"
    const val IDEMPOTENCY_KEY_CONFLICT = "IDEMPOTENCY_KEY_CONFLICT"
    const val CONTRACT_JOB_EXPIRED = "CONTRACT_JOB_EXPIRED"
    const val CONTRACT_JOB_CANCELLED = "CONTRACT_JOB_CANCELLED"
}
