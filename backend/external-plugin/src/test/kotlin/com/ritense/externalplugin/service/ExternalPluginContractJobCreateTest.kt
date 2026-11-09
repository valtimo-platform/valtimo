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
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import java.util.UUID

/** `POST /jobs` admission: reply handles, documentId and idempotency keys. */
class ExternalPluginContractJobCreateTest {

    private val fixture = ContractJobFixture()
    private val jobService = fixture.jobService

    // ---------------------------------------------------------------- reply handles and documentId

    @Test
    fun `a service token's reply handle names the process instance and case of the reply`() {
        val businessKey = UUID.randomUUID().toString()
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", businessKey)

        val job = fixture.job(fixture.createAccepted("generate", replyTo = handle))

        assertThat(job.replyToProcessInstanceId).isEqualTo("pi-1")
        assertThat(job.replyToBusinessKey).isEqualTo(businessKey)
        assertThat(job.documentId).isEqualTo(businessKey)
    }

    @Test
    fun `a reply handle issued for another configuration is refused`() {
        val handle = fixture.replyHandleSigner.issue(fixture.provider.id, "pi-1", null)

        assertThatThrownBy { fixture.create("generate", replyTo = handle) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("replyTo is not a valid reply handle for this configuration")
    }

    @Test
    fun `a tampered reply handle is refused`() {
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", null)

        assertThatThrownBy { fixture.create("generate", replyTo = handle.dropLast(2) + "AA") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("replyTo is not a valid reply handle for this configuration")
        assertThatThrownBy { fixture.create("generate", replyTo = "pi-1") }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `a documentId that contradicts the reply handle is refused`() {
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", "case-a")

        assertThatThrownBy { fixture.create("generate", replyTo = handle, documentId = "case-b") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("documentId does not match the case of the reply handle")
        assertThat(fixture.job(fixture.createAccepted("generate", replyTo = handle, documentId = "case-a")).documentId)
            .isEqualTo("case-a")
    }

    @Test
    fun `a requester may name a case without a reply handle, unverified, and the provider receives it`() {
        val job = fixture.job(fixture.createAccepted("generate", documentId = "case-a"))

        assertThat(job.documentId).isEqualTo("case-a")
        assertThat(job.replyToProcessInstanceId).isNull()

        fixture.providerAnswers(200, """{"status":"accepted"}""")
        fixture.dispatcher.deliverRequests()
        val body = argumentCaptor<ObjectNode>()
        verify(fixture.hostClient).invokeContract(any(), any(), any(), any(), any(), body.capture(), any(), anyOrNull())
        assertThat(body.firstValue.get("documentId").asText()).isEqualTo("case-a")
    }

    // ---------------------------------------------------------------- idempotency

    @Test
    fun `a malformed idempotency key is refused`() {
        listOf("", "with space", "x".repeat(256), "naïve").forEach { key ->
            assertThatThrownBy { fixture.create("generate", idempotencyKey = key) }
                .describedAs(key)
                .isInstanceOf(IllegalArgumentException::class.java)
                .hasMessage("idempotencyKey must be 1-255 visible ASCII characters")
        }
    }

    @Test
    fun `a repeated idempotency key answers with the existing job`() {
        val first = fixture.createAccepted("generate", idempotencyKey = "order-42")

        val repeated = fixture.create("generate", idempotencyKey = "order-42")

        assertThat(repeated).isEqualTo(ContractOutcome.accepted(first))
        assertThat(fixture.jobs).hasSize(1)
    }

    @Test
    fun `an idempotency key reused for another operation is a conflict`() {
        fixture.createAccepted("generate", idempotencyKey = "order-42")

        val conflict = fixture.create("archive", idempotencyKey = "order-42")

        assertThat(conflict.status).isEqualTo("error")
        assertThat(conflict.errorCode).isEqualTo("IDEMPOTENCY_KEY_CONFLICT")
        assertThat(fixture.jobs).hasSize(1)
    }

    @Test
    fun `losing the insert race to the same key answers with the winner`() {
        val winner = UUID.randomUUID()
        val winning = existingJob(winner, "generate")
        whenever(fixture.jobRepository.findByRequesterConfigurationIdAndIdempotencyKey(any(), any()))
            .thenReturn(null, winning)
        whenever(fixture.jobRepository.saveAndFlush(any<ExternalPluginContractJob>()))
            .thenThrow(DataIntegrityViolationException("ext_plugin_contract_job_idempotency_uq"))

        val outcome = fixture.create("generate", idempotencyKey = "order-42")

        assertThat(outcome).isEqualTo(ContractOutcome.accepted(winner))
    }

    @Test
    fun `an insert failure that is not an idempotency race propagates`() {
        whenever(fixture.jobRepository.saveAndFlush(any<ExternalPluginContractJob>()))
            .thenThrow(DataIntegrityViolationException("something else"))

        assertThatThrownBy { fixture.create("generate") }.isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `an idempotent replay answers before resolution, so a provider that changed since still answers with the job`() {
        val first = fixture.createAccepted("generate", idempotencyKey = "order-42")
        fixture.providerDefinition.pendingContentHash = "sha256:changed"

        assertThat(fixture.create("generate", idempotencyKey = "order-42")).isEqualTo(ContractOutcome.accepted(first))
    }

    private fun existingJob(id: UUID, operation: String) = ExternalPluginContractJob(
        id = id,
        contract = fixture.contract,
        operation = operation,
        requesterConfigurationId = fixture.requester.id,
        providerConfigurationId = fixture.provider.id,
        idempotencyKey = "order-42",
        requestPayload = "{}",
        deadline = fixture.clock.instant(),
    )
}
