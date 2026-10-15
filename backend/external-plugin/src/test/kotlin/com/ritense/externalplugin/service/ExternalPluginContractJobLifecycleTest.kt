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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient.ActionResponse
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Duration
import java.util.UUID

/**
 * The job ledger end to end over an in-memory store: create → deliver → accept → complete → reply →
 * delivered, plus expiry, ownership, retries, deferral, the per-run host short-circuit and the
 * undeliverable cut-off.
 */
class ExternalPluginContractJobLifecycleTest {

    private val fixture = ContractJobFixture()
    private val objectMapper = fixture.objectMapper
    private val contract = fixture.contract
    private val clock = fixture.clock
    private val hostClient = fixture.hostClient
    private val jobService = fixture.jobService
    private val dispatcher = fixture.dispatcher
    private val requester = fixture.requester
    private val provider = fixture.provider

    @Test
    fun `create, deliver, accept, complete, reply, delivered`() {
        val jobId = fixture.createAccepted("generate")
        val stored = fixture.job(jobId)
        assertThat(stored.status).isEqualTo(ExternalPluginContractJobStatus.PENDING)
        assertThat(stored.requestPayload).doesNotContain("pdca-report")
        assertThat(stored.deadline).isEqualTo(clock.instant().plus(Duration.ofHours(2)))

        fixture.providerAnswers(200, """{"status":"accepted"}""")
        dispatcher.dispatch()

        val delivered = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContract(
            any(), eq("generator"), any(), eq(contract), eq("generate"), delivered.capture(), eq("host-secret"), eq(jobId.toString()),
        )
        assertThat(delivered.firstValue.get("jobId").asText()).isEqualTo(jobId.toString())
        assertThat(delivered.firstValue.get("deadline").asText()).isEqualTo(stored.deadline.toString())
        assertThat(delivered.firstValue.get("payload").get("templateKey").asText()).isEqualTo("pdca-report")
        assertThat(delivered.firstValue.has("documentId")).isFalse()
        assertThat(delivered.firstValue.has("requestedBy")).isFalse()
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.ACCEPTED)

        val result = objectMapper.createObjectNode().put("documentRef", "https://docs/1").put("contentHash", "sha256:x")
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Completed)
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(fixture.job(jobId).outcome).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(fixture.job(jobId).resultPayload).doesNotContain("docs/1")

        fixture.requesterAnswers(200, """{"status":"completed"}""")
        dispatcher.dispatch()

        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), eq("pdca"), any(), reply.capture(), eq("host-secret"), eq(jobId.toString()))
        assertThat(reply.firstValue.get("configurationId").asText()).isEqualTo(requester.id.toString())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("completed")
        assertThat(reply.firstValue.get("result").get("documentRef").asText()).isEqualTo("https://docs/1")
        assertThat(reply.firstValue.get("requestedAt").asText()).isEqualTo(stored.createdAt.toString())
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(fixture.job(jobId).outcome).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(fixture.job(jobId).deliveredAt).isNotNull()
    }

    @Test
    fun `a provider that completes during delivery is not overwritten by its own late accepted answer`() {
        val jobId = fixture.createAccepted("generate")
        whenever(hostClient.invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull())).thenAnswer {
            jobService.complete(provider.id, jobId, "completed", objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h"), null, null)
            ActionResponse(200, fixture.json("""{"status":"accepted"}"""))
        }

        dispatcher.deliverRequests()

        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
    }

    @Test
    fun `an immediate completed answer completes the job on delivery`() {
        val jobId = fixture.createAccepted("generate")
        fixture.providerAnswers(200, """{"status":"completed","result":{"documentRef":"r","contentHash":"h"}}""")

        dispatcher.deliverRequests()

        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(jobService.get(requester.id, jobId)!!.result!!.get("documentRef").asText()).isEqualTo("r")
    }

    @Test
    fun `a provider error answer fails the job and the reply carries the provider's own code`() {
        val jobId = fixture.createAccepted("generate")
        fixture.providerAnswers(200, """{"status":"error","errorCode":"TEMPLATE_MISSING","errorMessage":"no template"}""")
        fixture.requesterAnswers(200, """{"status":"completed"}""")

        dispatcher.dispatch()
        dispatcher.dispatch()

        val job = fixture.job(jobId)
        assertThat(job.errorCode).isEqualTo("PROVIDER_ERROR")
        assertThat(job.providerErrorCode).isEqualTo("TEMPLATE_MISSING")
        assertThat(job.errorMessage).isEqualTo("no template")
        assertThat(jobService.get(requester.id, jobId)!!.providerErrorCode).isEqualTo("TEMPLATE_MISSING")
        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), any(), any(), reply.capture(), any(), anyOrNull())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("failed")
        assertThat(reply.firstValue.get("errorCode").asText()).isEqualTo("PROVIDER_ERROR")
        assertThat(reply.firstValue.get("providerErrorCode").asText()).isEqualTo("TEMPLATE_MISSING")
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(job.outcome).isEqualTo(ExternalPluginContractJobStatus.FAILED)
    }

    @Test
    fun `an unreachable provider is retried with exponential backoff`() {
        val jobId = fixture.createAccepted("generate")
        fixture.providerAnswers(503, """{"errorCode":"EXTERNAL_PLUGIN_HOST_UNREACHABLE","errorMessage":"down"}""")

        dispatcher.deliverRequests()
        val first = fixture.job(jobId)
        assertThat(first.status).isEqualTo(ExternalPluginContractJobStatus.PENDING)
        assertThat(first.deliveryAttempts).isEqualTo(1)
        assertThat(first.nextAttemptAt).isEqualTo(clock.instant().plusSeconds(5))
        assertThat(first.lastDeliveryError).startsWith("PROVIDER_UNREACHABLE")

        dispatcher.deliverRequests()
        verify(hostClient).invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull())

        clock.advance(Duration.ofSeconds(5))
        dispatcher.deliverRequests()
        assertThat(fixture.job(jobId).deliveryAttempts).isEqualTo(2)
        assertThat(fixture.job(jobId).nextAttemptAt).isEqualTo(clock.instant().plusSeconds(10))
        assertThat(dispatcher.backoff(20)).isEqualTo(Duration.ofMinutes(10))
    }

    @Test
    fun `a provider host that is unreachable is skipped for the rest of the run without spending attempts`() {
        val first = fixture.createAccepted("generate")
        val second = fixture.createAccepted("archive")
        fixture.providerAnswers(503, """{"errorCode":"EXTERNAL_PLUGIN_HOST_UNREACHABLE","errorMessage":"down"}""")

        dispatcher.dispatch()

        verify(hostClient, times(1)).invokeContract(any(), any(), any(), any(), any(), any(), any(), anyOrNull())
        assertThat(fixture.job(first).deliveryAttempts).isEqualTo(1)
        val skipped = fixture.job(second)
        assertThat(skipped.status).isEqualTo(ExternalPluginContractJobStatus.PENDING)
        assertThat(skipped.deliveryAttempts).isZero()
        assertThat(skipped.lastDeliveryError).isNull()
        assertThat(skipped.nextAttemptAt).isEqualTo(clock.instant().plusSeconds(5))
    }

    @Test
    fun `a requester host that is unreachable is skipped for the rest of the run`() {
        val first = fixture.createAccepted("generate")
        val second = fixture.createAccepted("archive")
        jobService.complete(provider.id, first, "failed", null, null, null)
        jobService.complete(provider.id, second, "failed", null, null, null)
        fixture.requesterAnswers(502, null)

        dispatcher.deliverReplies()

        verify(hostClient, times(1)).invokeContractReply(any(), any(), any(), any(), any(), anyOrNull())
        val attempted = listOf(fixture.job(first), fixture.job(second)).single { it.deliveryAttempts == 1 }
        val skipped = listOf(fixture.job(first), fixture.job(second)).single { it.id != attempted.id }
        assertThat(attempted.lastDeliveryError).contains("502")
        assertThat(skipped.deliveryAttempts).isZero()
        assertThat(skipped.lastDeliveryError).isNull()
        assertThat(skipped.nextAttemptAt).isEqualTo(clock.instant().plusSeconds(5))
    }

    @Test
    fun `a reply to a requester that cannot take it yet is deferred without counting an attempt`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(provider.id, jobId, "failed", null, null, null)
        fixture.requesterDefinition.pendingContentHash = "sha256:changed"

        dispatcher.deliverReplies()

        val job = fixture.job(jobId)
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(job.deliveryAttempts).isZero()
        assertThat(job.nextAttemptAt).isEqualTo(clock.instant().plus(Duration.ofMinutes(10)))
        assertThat(job.lastDeliveryError).contains("not active")
        verify(hostClient, times(0)).invokeContractReply(any(), any(), any(), any(), any(), anyOrNull())
    }

    @Test
    fun `an unavailable requester defers the reply as well`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(provider.id, jobId, "failed", null, null, null)
        fixture.requesterDefinition.status = ExternalPluginDefinitionStatus.UNAVAILABLE

        dispatcher.deliverReplies()

        assertThat(fixture.job(jobId).deliveryAttempts).isZero()
        assertThat(fixture.job(jobId).nextAttemptAt).isEqualTo(clock.instant().plus(Duration.ofMinutes(10)))
    }

    @Test
    fun `a requester without a reply handler acknowledges with ignored, which delivers the reply`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(provider.id, jobId, "failed", null, null, null)
        fixture.requesterAnswers(200, """{"status":"ignored"}""")

        dispatcher.deliverReplies()

        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `an overdue job expires and the requester is told`() {
        val jobId = fixture.createAccepted("generate")
        fixture.providerAnswers(200, """{"status":"accepted"}""")
        dispatcher.dispatch()
        clock.advance(Duration.ofHours(3))
        fixture.requesterAnswers(200, """{"status":"completed"}""")

        dispatcher.dispatch()

        val job = fixture.job(jobId)
        assertThat(job.errorCode).isEqualTo("CONTRACT_JOB_EXPIRED")
        val reply = argumentCaptor<ObjectNode>()
        verify(hostClient).invokeContractReply(any(), any(), any(), reply.capture(), any(), anyOrNull())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("expired")
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(job.outcome).isEqualTo(ExternalPluginContractJobStatus.EXPIRED)
        assertThat(jobService.complete(provider.id, jobId, "completed", null, null, null)).isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `a reply nobody acknowledges becomes undeliverable after the maximum attempts and keeps its outcome`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(provider.id, jobId, "failed", null, "BOOM", "broken")
        fixture.requesterAnswers(200, """{"status":"error","errorMessage":"handler crashed"}""")

        repeat(3) {
            dispatcher.deliverReplies()
            clock.advance(Duration.ofMinutes(10))
        }

        val job = fixture.job(jobId)
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.UNDELIVERABLE)
        assertThat(job.outcome).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(job.deliveryAttempts).isEqualTo(3)
        assertThat(job.lastDeliveryError).contains("handler crashed")
    }

    @Test
    fun `only the bound provider can complete, and only once`() {
        val jobId = fixture.createAccepted("generate")

        assertThat(jobService.complete(requester.id, jobId, "completed", null, null, null)).isEqualTo(CompletionResult.NotFound)
        assertThat(jobService.complete(provider.id, UUID.randomUUID(), "completed", null, null, null)).isEqualTo(CompletionResult.NotFound)
        val result = objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h")
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Completed)
        assertThat(jobService.complete(provider.id, jobId, "completed", result, null, null)).isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `a failed completion keeps the provider's code apart from the platform code`() {
        val jobId = fixture.createAccepted("generate")

        assertThat(jobService.complete(provider.id, jobId, "failed", null, "TEMPLATE_MISSING", null))
            .isEqualTo(CompletionResult.Completed)

        val job = fixture.job(jobId)
        assertThat(job.errorCode).isEqualTo("PROVIDER_ERROR")
        assertThat(job.providerErrorCode).isEqualTo("TEMPLATE_MISSING")
        assertThat(job.errorMessage).isEqualTo("The provider reported a failure")
    }

    @Test
    fun `stored error texts are truncated`() {
        val jobId = fixture.createAccepted("generate")

        jobService.complete(provider.id, jobId, "failed", null, "C".repeat(300), "m".repeat(5000))

        assertThat(fixture.job(jobId).errorMessage).hasSize(2000)
        assertThat(fixture.job(jobId).providerErrorCode).hasSize(255)
    }

    @Test
    fun `a completion missing a declared output fails the job`() {
        val jobId = fixture.createAccepted("generate")

        val outcome = jobService.complete(provider.id, jobId, "completed", objectMapper.createObjectNode().put("documentRef", "r"), null, null)

        assertThat(outcome).isInstanceOf(CompletionResult.Invalid::class.java)
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(fixture.job(jobId).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `an oversized completion fails the job as an invalid result`() {
        val small = ContractJobFixture(maxPayloadBytes = 64)
        val jobId = small.createAccepted("summarize")
        val result = small.objectMapper.createObjectNode().put("blob", "x".repeat(100))
        val size = small.objectMapper.writeValueAsBytes(result).size

        val outcome = small.jobService.complete(small.provider.id, jobId, "completed", result, null, null)

        assertThat(outcome).isEqualTo(
            CompletionResult.Invalid("PROVIDER_INVALID_RESULT", "Result is $size bytes; the maximum is 64")
        )
        assertThat(small.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(small.job(jobId).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `a completion that breaks the output schema fails the job`() {
        val schemaFixture = ContractJobFixture(
            providerManifest = ContractJobFixture.defaultProviderManifest("nl.ritense.document.generate@1").also { manifest ->
                (manifest.get("provides").get(0).get("operations").get(2) as ObjectNode).set<ObjectNode>(
                    "output",
                    objectMapper.readTree("""{"type":"object","required":["summary"],"properties":{"summary":{"type":"string"}}}"""),
                )
            },
        )
        val jobId = schemaFixture.createAccepted("summarize")

        val outcome = schemaFixture.jobService.complete(
            schemaFixture.provider.id, jobId, "completed", objectMapper.createObjectNode().put("summary", 5), null, null,
        ) as CompletionResult.Invalid

        assertThat(outcome.errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
        assertThat(outcome.errorMessage).startsWith("Result does not match the output schema of operation 'summarize'")
        assertThat(schemaFixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(
            schemaFixture.jobService.complete(schemaFixture.provider.id, jobId, "completed", null, null, null)
        ).isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `only requester and provider can read a job`() {
        val jobId = fixture.createAccepted("generate")

        assertThat(jobService.get(requester.id, jobId)!!.status).isEqualTo("pending")
        assertThat(jobService.get(provider.id, jobId)).isNotNull()
        assertThat(jobService.get(UUID.randomUUID(), jobId)).isNull()
    }

    @Test
    fun `the deadline is the provider's timeout capped by the platform maximum`() {
        val jobId = fixture.createAccepted("archive")

        assertThat(fixture.job(jobId).deadline).isEqualTo(clock.instant().plus(Duration.ofDays(1)))
        val defaulted = fixture.createAccepted("summarize")
        assertThat(fixture.job(defaulted).deadline).isEqualTo(clock.instant().plus(Duration.ofHours(1)))
    }

    @Test
    fun `delivered jobs are purged after the retention window`() {
        val jobId = fixture.createAccepted("generate")
        fixture.job(jobId).apply {
            status = ExternalPluginContractJobStatus.DELIVERED
            updatedAt = clock.instant()
        }
        clock.advance(Duration.ofDays(31))
        val open = fixture.createAccepted("generate")

        dispatcher.purge()

        assertThat(fixture.jobs.keys).containsExactly(open)
    }
}
