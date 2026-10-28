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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.client.ExternalPluginHostClient.ActionResponse
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginContractBinding
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginContractBindingRepository
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.security.ExternalPluginReplyHandleSigner
import com.ritense.plugin.service.EncryptionService
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Optional
import java.util.UUID

/**
 * The job ledger over an in-memory store: the real contract service, job service and dispatcher, with
 * the host client, the process engine and PBAC as mocks. One requester bound to one provider.
 */
class ContractJobFixture(
    val contract: String = "nl.ritense.document.generate@1",
    providerManifest: ObjectNode = defaultProviderManifest(contract),
    requesterManifest: ObjectNode = ObjectMapper().createObjectNode(),
    maxPayloadBytes: Int = 262_144,
    maxReplyAttempts: Int = 3,
) {
    val objectMapper = ObjectMapper()
    val clock = MutableClock(Instant.parse("2026-10-14T10:00:00Z"))
    val encryptionService = EncryptionService("abcdefghijklmnop")

    val definitions = mutableMapOf<UUID, ExternalPluginDefinition>()
    val configurations = mutableMapOf<UUID, ExternalPluginConfiguration>()
    val jobs = linkedMapOf<UUID, ExternalPluginContractJob>()

    val hostClient = mock<ExternalPluginHostClient>()
    val runtimeService = mock<RuntimeService>()
    val authorizationService = mock<AuthorizationService>()
    val documentService = mock<JsonSchemaDocumentService>()
    val eventPublisher = mock<ApplicationEventPublisher>()
    val jobRepository = inMemoryJobRepository()
    val replyHandleSigner = ExternalPluginReplyHandleSigner("abcdefghijklmnop", Duration.ofDays(1), clock)

    val host = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = "https://host.example.com",
        secret = encryptionService.encrypt("host-secret"),
        status = ExternalPluginHostStatus.CONNECTED,
        kind = ExternalPluginHostKind.PLUGIN_HOST,
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventQueueMode = EventQueueMode.LIVE,
    )

    val requesterDefinition = definition("pdca", requesterManifest)
    val providerDefinition = definition("generator", providerManifest)
    val requester = configuration(requesterDefinition)
    val provider = configuration(providerDefinition)

    val contractService: ExternalPluginContractService
    val jobService: ExternalPluginContractJobService
    val dispatcher: ExternalPluginContractJobDispatcher

    init {
        val configurationRepository = mock<ExternalPluginConfigurationRepository>()
        val definitionRepository = mock<ExternalPluginDefinitionRepository>()
        val hostRepository = mock<ExternalPluginHostRepository>()
        val bindingRepository = mock<ExternalPluginContractBindingRepository>()
        whenever(configurationRepository.findById(any())).thenAnswer { Optional.ofNullable(configurations[it.getArgument(0)]) }
        whenever(configurationRepository.findAllById(any())).thenAnswer { invocation ->
            invocation.getArgument<Iterable<UUID>>(0).mapNotNull { configurations[it] }
        }
        whenever(definitionRepository.findById(any())).thenAnswer { Optional.ofNullable(definitions[it.getArgument(0)]) }
        whenever(definitionRepository.findAllById(any())).thenAnswer { invocation ->
            invocation.getArgument<Iterable<UUID>>(0).mapNotNull { definitions[it] }
        }
        whenever(hostRepository.findById(any())).thenAnswer { invocation ->
            Optional.ofNullable(host.takeIf { it.id == invocation.getArgument(0) })
        }
        val binding = ExternalPluginContractBinding(UUID.randomUUID(), requester.id, contract, provider.id)
        whenever(bindingRepository.findByConfigurationIdAndContract(requester.id, contract)).thenReturn(binding)

        val transactionTemplate = TransactionTemplate(mock<PlatformTransactionManager>())
        contractService = ExternalPluginContractService(
            configurationRepository, definitionRepository, hostRepository, bindingRepository, hostClient,
            encryptionService, objectMapper, maxDepth = 4, maxPayloadBytes = maxPayloadBytes,
            readTimeout = Duration.ofSeconds(40), maxConcurrentCalls = 8, clock = clock,
        )
        jobService = ExternalPluginContractJobService(
            jobRepository, configurationRepository, definitionRepository, contractService, encryptionService,
            objectMapper, transactionTemplate, documentService, authorizationService, replyHandleSigner, eventPublisher,
            defaultTimeout = Duration.ofHours(1), maxDeadline = Duration.ofDays(1), clock = clock,
        )
        dispatcher = ExternalPluginContractJobDispatcher(
            jobRepository, configurationRepository, definitionRepository, hostRepository, contractService, jobService,
            hostClient, encryptionService, objectMapper, transactionTemplate, runtimeService,
            retryBase = Duration.ofSeconds(5), retryMax = Duration.ofMinutes(10), maxReplyAttempts = maxReplyAttempts,
            retention = Duration.ofDays(30), batchSize = 50, clock = clock,
        )
    }

    /** A job request with a service token unless [requestedBy] names a user. */
    fun create(
        operation: String,
        replyTo: String? = null,
        documentId: String? = null,
        idempotencyKey: String? = null,
        requestedBy: String? = null,
        payload: JsonNode = objectMapper.createObjectNode().put("templateKey", "pdca-report"),
    ): ContractOutcome = jobService.create(
        requesterConfigurationId = requester.id,
        contract = contract,
        operation = operation,
        payload = payload,
        replyTo = replyTo,
        documentId = documentId,
        idempotencyKey = idempotencyKey,
        requestedBy = requestedBy,
        chainHeader = null,
        correlationIdHeader = null,
    )

    fun createAccepted(
        operation: String,
        replyTo: String? = null,
        documentId: String? = null,
        idempotencyKey: String? = null,
        requestedBy: String? = null,
    ): UUID = create(operation, replyTo, documentId, idempotencyKey, requestedBy).let {
        check(it.status == "accepted") { "Expected an accepted job, got ${it.errorCode}: ${it.errorMessage}" }
        it.jobId!!
    }

    fun providerAnswers(status: Int, body: String?) {
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull()))
            .thenReturn(ActionResponse(status, body?.let(::json)))
    }

    fun requesterAnswers(status: Int, body: String?) {
        whenever(hostClient.invokeContractReply(any(), any(), any(), any(), any(), anyOrNull()))
            .thenReturn(ActionResponse(status, body?.let(::json)))
    }

    fun job(id: UUID): ExternalPluginContractJob = jobs.getValue(id)

    fun json(body: String): JsonNode = objectMapper.readTree(body)

    fun definition(pluginId: String, manifest: ObjectNode, hostId: UUID = host.id) = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = pluginId,
        version = "1.0.0",
        hostId = hostId,
        baseUrl = "${host.baseUrl}/plugins/$pluginId",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        manifestJson = manifest,
        contentHash = "sha256:accepted",
    ).also { definitions[it.id] = it }

    fun configuration(definition: ExternalPluginDefinition) = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = definition.pluginId,
    ).also { configurations[it.id] = it }

    private fun inMemoryJobRepository(): ExternalPluginContractJobRepository {
        val repository = mock<ExternalPluginContractJobRepository>()
        whenever(repository.save(any<ExternalPluginContractJob>())).thenAnswer {
            it.getArgument<ExternalPluginContractJob>(0).also { job -> jobs[job.id] = job }
        }
        whenever(repository.saveAndFlush(any<ExternalPluginContractJob>())).thenAnswer {
            it.getArgument<ExternalPluginContractJob>(0).also { job -> jobs[job.id] = job }
        }
        whenever(repository.findById(any())).thenAnswer { Optional.ofNullable(jobs[it.getArgument(0)]) }
        whenever(repository.findByIdForUpdate(any())).thenAnswer { jobs[it.getArgument(0)] }
        whenever(repository.findByRequesterConfigurationIdAndIdempotencyKey(any(), any())).thenAnswer { invocation ->
            jobs.values.firstOrNull {
                it.requesterConfigurationId == invocation.getArgument(0) && it.idempotencyKey == invocation.getArgument(1)
            }
        }
        whenever(repository.findAllByStatusInAndDeadlineBefore(any(), any(), any())).thenAnswer { invocation ->
            val statuses = invocation.getArgument<Collection<ExternalPluginContractJobStatus>>(0)
            val now = invocation.getArgument<Instant>(1)
            jobs.values.filter { it.status in statuses && it.deadline.isBefore(now) }
        }
        whenever(repository.findAllByStatusInAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(any(), any(), any()))
            .thenAnswer { invocation ->
                val statuses = invocation.getArgument<Collection<ExternalPluginContractJobStatus>>(0)
                val now = invocation.getArgument<Instant>(1)
                jobs.values.filter { it.status in statuses && it.nextAttemptAt?.isAfter(now) == false }
                    .sortedBy { it.nextAttemptAt }
            }
        whenever(repository.deleteAllByStatusInAndUpdatedAtBefore(any(), any())).thenAnswer { invocation ->
            val statuses = invocation.getArgument<Collection<ExternalPluginContractJobStatus>>(0)
            val cutoff = invocation.getArgument<Instant>(1)
            val purged = jobs.values.filter { it.status in statuses && it.updatedAt.isBefore(cutoff) }.map { it.id }
            purged.forEach { jobs.remove(it) }
            purged.size
        }
        return repository
    }

    class MutableClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
    }

    companion object {
        fun defaultProviderManifest(contract: String): ObjectNode = ObjectMapper().readTree(
            """
            {"provides": [{"contract": "$contract", "operations": [
                {"key": "generate", "title": "Generate", "mode": "job", "timeout": "PT2H", "outputs": ["documentRef", "contentHash"]},
                {"key": "archive", "title": "Archive", "mode": "job", "timeout": "P7D"},
                {"key": "summarize", "title": "Summarize", "mode": "job"}
            ]}]}
            """.trimIndent()
        ) as ObjectNode
    }
}
