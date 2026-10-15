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
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.access.AccessDeniedException
import java.util.Optional
import java.util.UUID

/** `POST /jobs` admission: who may ask for what, reply handles, and idempotency keys. */
class ExternalPluginContractJobCreateTest {

    private val fixture = ContractJobFixture()
    private val jobService = fixture.jobService

    // ---------------------------------------------------------------- user tokens

    @Test
    fun `a user token must name the case it acts on`() {
        assertThatThrownBy { fixture.create("generate", requestedBy = "jdoe") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("A user token must name the case it acts on (documentId)")
        assertThat(fixture.jobs).isEmpty()
    }

    @Test
    fun `a user token cannot ask for a BPMN reply`() {
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", UUID.randomUUID().toString())

        assertThatThrownBy {
            fixture.create("generate", replyTo = handle, documentId = UUID.randomUUID().toString(), requestedBy = "jdoe")
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("replyTo requires a service token")
    }

    @Test
    fun `a user token's documentId must be an existing case`() {
        assertThatThrownBy { fixture.create("generate", documentId = "not-a-uuid", requestedBy = "jdoe") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("not a valid document id")

        val missing = UUID.randomUUID()
        whenever(fixture.documentService.findBy(any())).thenReturn(Optional.empty())
        assertThatThrownBy { fixture.create("generate", documentId = missing.toString(), requestedBy = "jdoe") }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessage("documentId '$missing' does not exist")
    }

    @Test
    fun `a user token is bounded by the user's PBAC on the case`() {
        val documentId = UUID.randomUUID()
        whenever(fixture.documentService.findBy(any())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
        doThrow(AccessDeniedException("no")).whenever(fixture.authorizationService).requirePermission<JsonSchemaDocument>(any())

        assertThatThrownBy { fixture.create("generate", documentId = documentId.toString(), requestedBy = "jdoe") }
            .isInstanceOf(AccessDeniedException::class.java)
        assertThat(fixture.jobs).isEmpty()
    }

    @Test
    fun `a user-token job records the user and the case and forwards both to the provider`() {
        val documentId = UUID.randomUUID()
        whenever(fixture.documentService.findBy(any())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))

        val jobId = fixture.createAccepted("generate", documentId = documentId.toString(), requestedBy = "jdoe")

        val job = fixture.job(jobId)
        assertThat(job.requestedBy).isEqualTo("jdoe")
        assertThat(job.documentId).isEqualTo(documentId.toString())
        verify(fixture.authorizationService).requirePermission<JsonSchemaDocument>(any())

        fixture.providerAnswers(200, """{"status":"accepted"}""")
        fixture.dispatcher.deliverRequests()
        val body = argumentCaptor<ObjectNode>()
        verify(fixture.hostClient).invokeContract(any(), any(), any(), any(), any(), body.capture(), any(), anyOrNull())
        assertThat(body.firstValue.get("documentId").asText()).isEqualTo(documentId.toString())
        assertThat(body.firstValue.get("requestedBy").asText()).isEqualTo("jdoe")
    }

    // ---------------------------------------------------------------- service tokens and reply handles

    @Test
    fun `a service token's reply handle names the process instance and case of the reply`() {
        val businessKey = UUID.randomUUID().toString()
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", businessKey)

        val job = fixture.job(fixture.createAccepted("generate", replyTo = handle))

        assertThat(job.replyToProcessInstanceId).isEqualTo("pi-1")
        assertThat(job.replyToBusinessKey).isEqualTo(businessKey)
        assertThat(job.documentId).isEqualTo(businessKey)
        assertThat(job.requestedBy).isNull()
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
    fun `a service token may name a case without a reply handle, unchecked by PBAC`() {
        val job = fixture.job(fixture.createAccepted("generate", documentId = "case-a"))

        assertThat(job.documentId).isEqualTo("case-a")
        assertThat(job.replyToProcessInstanceId).isNull()
        verify(fixture.authorizationService, never()).requirePermission<JsonSchemaDocument>(any())
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
