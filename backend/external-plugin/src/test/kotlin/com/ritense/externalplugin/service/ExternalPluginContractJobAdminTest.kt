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
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.event.ExternalPluginContractJobPayloadViewedEvent
import com.ritense.externalplugin.service.ExternalPluginContractJobService.AdminJobResult
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import com.ritense.externalplugin.web.rest.dto.ContractJobDetailResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import java.time.Duration
import java.util.UUID

/** The administrator's job controls: cancel, redeliver and the audited payload read. */
class ExternalPluginContractJobAdminTest {

    private val fixture = ContractJobFixture()
    private val jobService = fixture.jobService
    private val clock = fixture.clock

    @Test
    fun `cancelling an open job fails it and still replies`() {
        val jobId = fixture.createAccepted("generate")

        val result = jobService.cancel(jobId, "admin") as AdminJobResult.Updated

        assertThat(result.job.status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(result.job.outcome).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(result.job.errorCode).isEqualTo("CONTRACT_JOB_CANCELLED")
        assertThat(result.job.errorMessage).isEqualTo("Cancelled by admin")

        fixture.requesterAnswers(200, """{"status":"completed"}""")
        fixture.dispatcher.dispatch()
        val reply = argumentCaptor<ObjectNode>()
        verify(fixture.hostClient).invokeContractReply(any(), any(), any(), reply.capture(), any(), anyOrNull())
        assertThat(reply.firstValue.get("status").asText()).isEqualTo("failed")
        assertThat(reply.firstValue.get("errorCode").asText()).isEqualTo("CONTRACT_JOB_CANCELLED")
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `a provider cannot complete a cancelled job`() {
        val jobId = fixture.createAccepted("generate")
        jobService.cancel(jobId, "admin")

        assertThat(jobService.complete(fixture.provider.id, jobId, "failed", null, null, null))
            .isEqualTo(CompletionResult.Conflict)
    }

    @Test
    fun `cancelling a finished job abandons its reply`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(fixture.provider.id, jobId, "failed", null, null, null)

        val result = jobService.cancel(jobId, "admin") as AdminJobResult.Updated

        assertThat(result.job.status).isEqualTo(ExternalPluginContractJobStatus.UNDELIVERABLE)
        assertThat(result.job.outcome).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(result.job.lastDeliveryError).isEqualTo("Reply delivery cancelled by admin")
        assertThat(fixture.job(jobId).nextAttemptAt).isNull()
        fixture.dispatcher.dispatch()
        verify(fixture.hostClient, never()).invokeContractReply(any(), any(), any(), any(), any(), anyOrNull())
    }

    @Test
    fun `delivered and undeliverable jobs cannot be cancelled, unknown jobs are not found`() {
        val delivered = fixture.createAccepted("generate")
        fixture.job(delivered).status = ExternalPluginContractJobStatus.DELIVERED
        val undeliverable = fixture.createAccepted("generate")
        fixture.job(undeliverable).status = ExternalPluginContractJobStatus.UNDELIVERABLE

        assertThat(jobService.cancel(delivered, "admin")).isEqualTo(AdminJobResult.Conflict)
        assertThat(jobService.cancel(undeliverable, "admin")).isEqualTo(AdminJobResult.Conflict)
        assertThat(jobService.cancel(UUID.randomUUID(), "admin")).isEqualTo(AdminJobResult.NotFound)
    }

    @Test
    fun `redelivering an undeliverable reply restores its outcome with a fresh attempt budget`() {
        val jobId = fixture.createAccepted("generate")
        jobService.complete(fixture.provider.id, jobId, "failed", null, null, null)
        fixture.requesterAnswers(500, """{"errorMessage":"down"}""")
        repeat(3) {
            fixture.dispatcher.deliverReplies()
            clock.advance(Duration.ofMinutes(10))
        }
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.UNDELIVERABLE)

        val result = jobService.redeliver(jobId, "admin") as AdminJobResult.Updated

        assertThat(result.job.status).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(result.job.deliveryAttempts).isZero()
        assertThat(result.job.lastDeliveryError).isNull()
        assertThat(fixture.job(jobId).nextAttemptAt).isEqualTo(clock.instant())

        fixture.requesterAnswers(200, """{"status":"completed"}""")
        fixture.dispatcher.deliverReplies()
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `only an undeliverable job with an outcome can be redelivered`() {
        val open = fixture.createAccepted("generate")
        val withoutOutcome = fixture.createAccepted("generate")
        fixture.job(withoutOutcome).status = ExternalPluginContractJobStatus.UNDELIVERABLE

        assertThat(jobService.redeliver(open, "admin")).isEqualTo(AdminJobResult.Conflict)
        assertThat(jobService.redeliver(withoutOutcome, "admin")).isEqualTo(AdminJobResult.Conflict)
        assertThat(jobService.redeliver(UUID.randomUUID(), "admin")).isEqualTo(AdminJobResult.NotFound)
    }

    @Test
    fun `reading the payloads decrypts them and publishes an audit event`() {
        val documentId = UUID.randomUUID()
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", documentId.toString())
        val jobId = fixture.createAccepted("generate", replyTo = handle)
        jobService.complete(
            fixture.provider.id,
            jobId,
            "completed",
            fixture.objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h"),
            null,
            null,
        )

        val payload = jobService.payload(jobId, "admin")!!

        assertThat(payload.requestPayload!!.get("templateKey").asText()).isEqualTo("pdca-report")
        assertThat(payload.resultPayload!!.get("documentRef").asText()).isEqualTo("r")
        val event = argumentCaptor<Any>()
        verify(fixture.eventPublisher).publishEvent(event.capture())
        val viewed = event.firstValue as ExternalPluginContractJobPayloadViewedEvent
        assertThat(viewed.getDocumentId()).isEqualTo(documentId)
        assertThat(viewed.getJobId()).isEqualTo(jobId)
        assertThat(viewed.getContract()).isEqualTo(fixture.contract)
        assertThat(viewed.getOperation()).isEqualTo("generate")
        assertThat(viewed.user).isNotBlank()
    }

    @Test
    fun `a payload read of a job without a case audits without a document`() {
        val jobId = fixture.createAccepted("generate", documentId = "not-a-uuid")

        jobService.payload(jobId, "admin")

        val event = argumentCaptor<Any>()
        verify(fixture.eventPublisher).publishEvent(event.capture())
        assertThat((event.firstValue as ExternalPluginContractJobPayloadViewedEvent).getDocumentId()).isNull()
    }

    @Test
    fun `an unknown job has no payloads and nothing is audited`() {
        assertThat(jobService.payload(UUID.randomUUID(), "admin")).isNull()
        verify(fixture.eventPublisher, never()).publishEvent(any<Any>())
    }

    @Test
    fun `the detail view carries the outcome and case but no payloads`() {
        val jobId = fixture.createAccepted("generate", documentId = "case-a", idempotencyKey = "order-42")
        jobService.complete(fixture.provider.id, jobId, "failed", null, "TEMPLATE_MISSING", "no template")

        val detail = jobService.detail(jobId)!!

        assertThat(detail.outcome).isEqualTo(ExternalPluginContractJobStatus.FAILED)
        assertThat(detail.documentId).isEqualTo("case-a")
        assertThat(detail.idempotencyKey).isEqualTo("order-42")
        assertThat(detail.providerErrorCode).isEqualTo("TEMPLATE_MISSING")
        assertThat(ContractJobDetailResponse::class.java.declaredFields.map { it.name })
            .doesNotContain("requestPayload", "resultPayload")
    }
}
