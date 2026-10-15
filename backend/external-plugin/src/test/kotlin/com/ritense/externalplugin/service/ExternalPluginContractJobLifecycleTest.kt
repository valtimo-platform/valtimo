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
import com.ritense.document.domain.impl.JsonSchemaDocument
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
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import com.ritense.plugin.service.EncryptionService
import com.ritense.processdocument.service.CorrelationService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery
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
 * The job ledger end to end over an in-memory store: create → deliver → accept → complete → reply →
 * delivered, plus expiry, ownership, retries, the undeliverable cut-off and BPMN replies.
 */
class ExternalPluginContractJobLifecycleTest {

    private val objectMapper = ObjectMapper()
    private val contract = "nl.ritense.document.generate@1"
    private val clock = MutableClock(Instant.parse("2026-10-14T10:00:00Z"))
    private val encryptionService = EncryptionService("abcdefghijklmnop")

    private val definitions = mutableMapOf<UUID, ExternalPluginDefinition>()
    private val configurations = mutableMapOf<UUID, ExternalPluginConfiguration>()
    private val jobs = linkedMapOf<UUID, ExternalPluginContractJob>()

    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var correlationService: CorrelationService
    private lateinit var runtimeService: RuntimeService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var documentService: JsonSchemaDocumentService
    private lateinit var jobService: ExternalPluginContractJobService
    private lateinit var dispatcher: ExternalPluginContractJobDispatcher

    private lateinit var requester: ExternalPluginConfiguration
    private lateinit var provider: ExternalPluginConfiguration
    private val host = ExternalPluginHost(
        id = UUID.randomUUID(),
        name = "host",
        baseUrl = "https://host.example.com",
        secret = encryptionService.encrypt("host-secret"),
        status = ExternalPluginHostStatus.CONNECTED,
        kind = ExternalPluginHostKind.PLUGIN_HOST,
        gzacCallbackBaseUrl = "http://gzac:8080",
        eventQueueMode = EventQueueMode.LIVE,
    )

    @BeforeEach
    fun setUp() {
        val configurationRepository = mock<ExternalPluginConfigurationRepository>()
        val definitionRepository = mock<ExternalPluginDefinitionRepository>()
        val hostRepository = mock<ExternalPluginHostRepository>()
        val bindingRepository = mock<ExternalPluginContractBindingRepository>()
        val jobRepository = inMemoryJobRepository()
        hostClient = mock()
        correlationService = mock()
        runtimeService = mock()
        authorizationService = mock()
        documentService = mock()
        whenever(configurationRepository.findById(any())).thenAnswer { Optional.ofNullable(configurations[it.getArgument(0)]) }
        whenever(configurationRepository.findAllById(any())).thenAnswer { invocation ->
            invocation.getArgument<Iterable<UUID>>(0).mapNotNull { configurations[it] }
        }
        whenever(definitionRepository.findById(any())).thenAnswer { Optional.ofNullable(definitions[it.getArgument(0)]) }
        whenever(definitionRepository.findAllById(any())).thenAnswer { invocation ->
            invocation.getArgument<Iterable<UUID>>(0).mapNotNull { definitions[it] }
        }
        whenever(hostRepository.findById(host.id)).thenReturn(Optional.of(host))

        val requesterDefinition = definition("pdca", objectMapper.createObjectNode())
        val providerDefinition = definition("generator", providerManifest())
        requester = configuration(requesterDefinition)
        provider = configuration(providerDefinition)
        val binding = ExternalPluginContractBinding(UUID.randomUUID(), requester.id, contract, provider.id)
        whenever(bindingRepository.findByConfigurationIdAndContract(requester.id, contract)).thenReturn(binding)

        val transactionTemplate = TransactionTemplate(mock<PlatformTransactionManager>())
        val contractService = ExternalPluginContractService(
            configurationRepository, definitionRepository, hostRepository, bindingRepository, hostClient,
            encryptionService, objectMapper, maxDepth = 4, maxPayloadBytes = 262_144,
        )
        jobService = ExternalPluginContractJobService(
            jobRepository, configurationRepository, definitionRepository, contractService, encryptionService,
            objectMapper, transactionTemplate, runtimeService, documentService, authorizationService,
            defaultTimeout = Duration.ofHours(1), maxDeadline = Duration.ofDays(1), maxPayloadBytes = 262_144,
            clock = clock,
        )
        dispatcher = ExternalPluginContractJobDispatcher(
            jobRepository, configurationRepository, definitionRepository, hostRepository, contractService, jobService,
            hostClient, encryptionService, objectMapper, transactionTemplate, correlationService,
            retryBase = Duration.ofSeconds(5), retryMax = Duration.ofMinutes(10), maxReplyAttempts = 3,
            retention = Duration.ofDays(30), batchSize = 50, clock = clock,
        )
    }

    @Test
    fun `create, deliver, accept, complete, reply, delivered`() {
        val jobId = create("generate").jobId!!
        val stored = jobs.getValue(jobId)
        assertThat(stored.status).isEqualTo(ExternalPluginContractJobStatus.PENDING)
        assertThat(stored.requestPayload).doesNotContain("pdca-report")
        assertThat(stored.deadline).isEqualTo(clock.instant().plus(Duration.ofHours(2)))

        providerAnswers(200, """{"status":"accepted"}""")
        dispatcher.dispatch()

        val delivered = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContract(any(), eq("generator"), any(), eq(contract), eq("generate"), delivered.capture(), eq("host-secret"))
        assertThat(delivered.firstValue.get("jobId").asText()).isEqualTo(jobId.toString())
        assertThat(delivered.firstValue.get("deadline").asText()).isEqualTo(stored.deadline.toString())
        assertThat(delivered.firstValue.get("payload").get("templateKey").asText()).isEqualTo("pdca-report")
        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.ACCEPTED)

        val result = objectMapper.createObjectNode().put("documentRef", "https://docs/1").put("contentHash", "sha256:x")
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Completed)
        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(jobs.getValue(jobId).resultPayload).doesNotContain("docs/1")

        requesterAnswers(200, """{"status":"completed"}""")
        dispatcher.dispatch()

        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), eq("pdca"), any(), reply.capture(), eq("host-secret"))
        assertThat(reply.firstValue.get("configurationId").asText()).isEqualTo(requester.id.toString())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("completed")
        assertThat(reply.firstValue.get("result").get("documentRef").asText()).isEqualTo("https://docs/1")
        assertThat(reply.firstValue.get("requestedAt").asText()).isEqualTo(stored.createdAt.toString())
        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(jobs.getValue(jobId).deliveredAt).isNotNull()
    }

    @Test
    fun `a provider that completes during delivery is not overwritten by its own late accepted answer`() {
        val jobId = create("generate").jobId!!
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any())).thenAnswer {
            jobService.complete(provider.id, jobId, "completed", objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h"), null, null)
            ActionResponse(200, json("""{"status":"accepted"}"""))
        }

        dispatcher.deliverRequests()

        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
    }

    @Test
    fun `an immediate completed answer completes the job on delivery`() {
        val jobId = create("generate").jobId!!
        providerAnswers(200, """{"status":"completed","result":{"documentRef":"r","contentHash":"h"}}""")

        dispatcher.deliverRequests()

        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(jobService.get(requester.id, jobId)!!.result!!.get("documentRef").asText()).isEqualTo("r")
    }

    @Test
    fun `a provider error answer fails the job and the failure is replied`() {
        val jobId = create("generate").jobId!!
        providerAnswers(200, """{"status":"error","errorCode":"TEMPLATE_MISSING","errorMessage":"no template"}""")
        requesterAnswers(200, """{"status":"completed"}""")

        dispatcher.dispatch()
        dispatcher.dispatch()

        val job = jobs.getValue(jobId)
        assertThat(job.errorCode).isEqualTo("PROVIDER_ERROR")
        assertThat(job.errorMessage).isEqualTo("TEMPLATE_MISSING: no template")
        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), any(), any(), reply.capture(), any())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("failed")
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `an unreachable provider is retried with exponential backoff`() {
        val jobId = create("generate").jobId!!
        providerAnswers(503, """{"errorCode":"EXTERNAL_PLUGIN_HOST_UNREACHABLE","errorMessage":"down"}""")

        dispatcher.deliverRequests()
        val first = jobs.getValue(jobId)
        assertThat(first.status).isEqualTo(ExternalPluginContractJobStatus.PENDING)
        assertThat(first.deliveryAttempts).isEqualTo(1)
        assertThat(first.nextAttemptAt).isEqualTo(clock.instant().plusSeconds(5))
        assertThat(first.lastDeliveryError).startsWith("PROVIDER_UNREACHABLE")

        dispatcher.deliverRequests()
        verify(hostClient).invokeContract(any(), any(), any(), any(), any(), any(), any())

        clock.advance(Duration.ofSeconds(5))
        dispatcher.deliverRequests()
        assertThat(jobs.getValue(jobId).deliveryAttempts).isEqualTo(2)
        assertThat(jobs.getValue(jobId).nextAttemptAt).isEqualTo(clock.instant().plusSeconds(10))
        assertThat(dispatcher.backoff(20)).isEqualTo(Duration.ofMinutes(10))
    }

    @Test
    fun `an overdue job expires and the requester is told`() {
        val jobId = create("generate").jobId!!
        providerAnswers(200, """{"status":"accepted"}""")
        dispatcher.dispatch()
        clock.advance(Duration.ofHours(3))
        requesterAnswers(200, """{"status":"completed"}""")

        dispatcher.dispatch()

        val job = jobs.getValue(jobId)
        assertThat(job.errorCode).isEqualTo("CONTRACT_JOB_EXPIRED")
        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), any(), any(), reply.capture(), any())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("expired")
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(jobService.complete(provider.id, jobId, "completed", null, null, null)).isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `a reply nobody acknowledges becomes undeliverable after the maximum attempts`() {
        val jobId = create("generate").jobId!!
        jobService.complete(provider.id, jobId, "failed", null, "BOOM", "broken")
        requesterAnswers(200, """{"status":"error","errorMessage":"handler crashed"}""")

        repeat(3) {
            dispatcher.deliverReplies()
            clock.advance(Duration.ofMinutes(10))
        }

        val job = jobs.getValue(jobId)
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.UNDELIVERABLE)
        assertThat(job.deliveryAttempts).isEqualTo(3)
        assertThat(job.lastDeliveryError).contains("handler crashed")
    }

    @Test
    fun `only the bound provider can complete, and only once`() {
        val jobId = create("generate").jobId!!

        assertThat(jobService.complete(requester.id, jobId, "completed", null, null, null)).isEqualTo(CompletionResult.NotFound)
        assertThat(jobService.complete(provider.id, UUID.randomUUID(), "completed", null, null, null)).isEqualTo(CompletionResult.NotFound)
        val result = objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h")
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Completed)
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `a completion missing a declared output fails the job`() {
        val jobId = create("generate").jobId!!

        val outcome = jobService.complete(provider.id, jobId, "completed", objectMapper.createObjectNode().put("documentRef", "r"), null, null)

        assertThat(outcome).isInstanceOf(CompletionResult.Invalid::class.java)
        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(jobs.getValue(jobId).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `only requester and provider can read a job`() {
        val jobId = create("generate").jobId!!

        assertThat(jobService.get(requester.id, jobId)!!.status).isEqualTo("pending")
        assertThat(jobService.get(provider.id, jobId)).isNotNull()
        assertThat(jobService.get(UUID.randomUUID(), jobId)).isNull()
    }

    @Test
    fun `the deadline is the provider's timeout capped by the platform maximum`() {
        val jobId = create("archive").jobId!!

        assertThat(jobs.getValue(jobId).deadline).isEqualTo(clock.instant().plus(Duration.ofDays(1)))
        val defaulted = create("summarize").jobId!!
        assertThat(jobs.getValue(defaulted).deadline).isEqualTo(clock.instant().plus(Duration.ofHours(1)))
    }

    @Test
    fun `a job requested with replyTo is answered as a BPMN message on the case`() {
        stubProcessInstance("pi-1", "doc-123")
        val jobId = create("generate", replyTo = "pi-1").jobId!!
        jobService.complete(provider.id, jobId, "completed", objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h"), null, null)

        dispatcher.deliverReplies()

        val variables = argumentCaptor<Map<String, Any?>>()
        verify(correlationService).sendCatchEventMessage(eq("contract-reply:$contract:generate"), eq("doc-123"), variables.capture())
        assertThat(variables.firstValue["jobId"]).isEqualTo(jobId.toString())
        assertThat(variables.firstValue["status"]).isEqualTo("completed")
        @Suppress("UNCHECKED_CAST")
        assertThat(variables.firstValue["result"] as Map<String, Any?>).containsEntry("documentRef", "r")
        verify(hostClient, never()).invokeContractReply(any(), any(), any(), any(), any())
        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `a BPMN reply nobody waits for yet is retried`() {
        stubProcessInstance("pi-1", "doc-123")
        val jobId = create("generate", replyTo = "pi-1").jobId!!
        jobService.complete(provider.id, jobId, "failed", null, null, null)
        whenever(correlationService.sendCatchEventMessage(any(), any(), anyOrNull<Map<String, Any?>>()))
            .thenThrow(IllegalStateException("no waiting execution"))

        dispatcher.deliverReplies()

        assertThat(jobs.getValue(jobId).status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(jobs.getValue(jobId).deliveryAttempts).isEqualTo(1)
        assertThat(jobs.getValue(jobId).lastDeliveryError).contains("no waiting execution")
    }

    @Test
    fun `a user-token request records the user and checks they may view the case`() {
        val documentId = UUID.randomUUID()
        val document = mock<JsonSchemaDocument>()
        whenever(documentService.get(documentId)).thenReturn(document)

        val jobId = create("generate", documentId = documentId.toString(), requestedBy = "jdoe").jobId!!

        assertThat(jobs.getValue(jobId).requestedBy).isEqualTo("jdoe")
        verify(authorizationService).requirePermission<JsonSchemaDocument>(any())
    }

    @Test
    fun `delivered jobs are purged after the retention window`() {
        val jobId = create("generate").jobId!!
        jobs.getValue(jobId).apply {
            status = ExternalPluginContractJobStatus.DELIVERED
            updatedAt = clock.instant()
        }
        clock.advance(Duration.ofDays(31))
        val open = create("generate").jobId!!

        dispatcher.purge()

        assertThat(jobs.keys).containsExactly(open)
    }

    // ---------------------------------------------------------------- helpers

    private fun create(
        operation: String,
        replyTo: String? = null,
        documentId: String? = null,
        requestedBy: String? = null,
    ): ContractOutcome = jobService.create(
        requesterConfigurationId = requester.id,
        contract = contract,
        operation = operation,
        payload = objectMapper.createObjectNode().put("templateKey", "pdca-report"),
        replyToProcessInstanceId = replyTo,
        documentId = documentId,
        requestedBy = requestedBy,
        chainHeader = null,
    ).also { assertThat(it.status).describedAs(it.errorMessage).isEqualTo("accepted") }

    private fun providerAnswers(status: Int, body: String) {
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(status, json(body)))
    }

    private fun requesterAnswers(status: Int, body: String) {
        whenever(hostClient.invokeContractReply(any(), any(), any(), any(), any()))
            .thenReturn(ActionResponse(status, json(body)))
    }

    private fun stubProcessInstance(id: String, businessKey: String) {
        val query = mock<ProcessInstanceQuery>()
        val instance = mock<ProcessInstance>()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(id)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(instance)
        whenever(instance.businessKey).thenReturn(businessKey)
    }

    private fun json(body: String): JsonNode = objectMapper.readTree(body)

    private fun inMemoryJobRepository(): ExternalPluginContractJobRepository {
        val repository = mock<ExternalPluginContractJobRepository>()
        whenever(repository.save(any<ExternalPluginContractJob>())).thenAnswer {
            it.getArgument<ExternalPluginContractJob>(0).also { job -> jobs[job.id] = job }
        }
        whenever(repository.findById(any())).thenAnswer { Optional.ofNullable(jobs[it.getArgument(0)]) }
        whenever(repository.findByIdForUpdate(any())).thenAnswer { jobs[it.getArgument(0)] }
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

    private fun providerManifest(): ObjectNode = objectMapper.readTree(
        """
        {"provides": [{"contract": "$contract", "operations": [
            {"key": "generate", "title": "Generate", "mode": "job", "timeout": "PT2H", "outputs": ["documentRef", "contentHash"]},
            {"key": "archive", "title": "Archive", "mode": "job", "timeout": "P7D"},
            {"key": "summarize", "title": "Summarize", "mode": "job"}
        ]}]}
        """.trimIndent()
    ) as ObjectNode

    private fun definition(pluginId: String, manifest: ObjectNode) = ExternalPluginDefinition(
        id = UUID.randomUUID(),
        pluginId = pluginId,
        version = "1.0.0",
        hostId = host.id,
        baseUrl = "${host.baseUrl}/plugins/$pluginId",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        manifestJson = manifest,
        contentHash = "sha256:accepted",
    ).also { definitions[it.id] = it }

    private fun configuration(definition: ExternalPluginDefinition) = ExternalPluginConfiguration(
        id = UUID.randomUUID(),
        definitionId = definition.id,
        title = definition.pluginId,
    ).also { configurations[it.id] = it }

    private class MutableClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) {
            now = now.plus(duration)
        }

        override fun instant(): Instant = now
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
    }
}
