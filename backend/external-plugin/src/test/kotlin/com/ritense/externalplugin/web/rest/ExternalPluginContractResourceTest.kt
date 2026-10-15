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

package com.ritense.externalplugin.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.security.ExternalPluginServicePrincipal
import com.ritense.externalplugin.security.ExternalPluginUserPrincipal
import com.ritense.externalplugin.service.ContractOutcome
import com.ritense.externalplugin.service.ExternalPluginContractJobService
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import com.ritense.externalplugin.service.ExternalPluginContractService
import com.ritense.externalplugin.web.rest.dto.ContractCallRequest
import com.ritense.externalplugin.web.rest.dto.ContractJobCompleteRequest
import com.ritense.externalplugin.web.rest.dto.ContractJobCreateRequest
import com.ritense.externalplugin.web.rest.dto.ContractResponse
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import java.util.UUID

/** The token names the calling configuration; nothing in the body can choose another one. */
class ExternalPluginContractResourceTest {

    private val objectMapper = ObjectMapper()
    private val configurationId = UUID.randomUUID()
    private val contract = "nl.ritense.openplan@1"

    private lateinit var contractService: ExternalPluginContractService
    private lateinit var jobService: ExternalPluginContractJobService
    private lateinit var resource: ExternalPluginContractResource

    @BeforeEach
    fun setUp() {
        contractService = mock()
        jobService = mock()
        resource = ExternalPluginContractResource(contractService, jobService)
    }

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `call runs as the service token's configuration and forwards the contract headers`() {
        authenticateAsService()
        whenever(contractService.call(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenReturn(ContractOutcome.completed(objectMapper.createObjectNode().put("ok", true)))

        val response = resource.call(
            ContractCallRequest(contract, "list", objectMapper.createObjectNode()),
            "a,b",
            "2026-10-15T10:00:30Z",
            "trace-1",
        )

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body!!.status).isEqualTo("completed")
        verify(contractService).call(
            eq(configurationId), eq(contract), eq("list"), any(), eq("a,b"), eq("2026-10-15T10:00:30Z"), eq("trace-1"),
        )
    }

    @Test
    fun `a contract error is a 200 with the structured error`() {
        authenticateAsService()
        whenever(contractService.call(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenReturn(ContractOutcome.error("NO_PROVIDER_BOUND", "none"))

        val response = call(ContractCallRequest(contract, "list"))

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEqualTo(ContractResponse(status = "error", errorCode = "NO_PROVIDER_BOUND", errorMessage = "none"))
        assertThat(objectMapper.writeValueAsString(response.body))
            .doesNotContain("result").doesNotContain("jobId").doesNotContain("providerErrorCode")
    }

    @Test
    fun `a provider's own error code reaches the calling plugin`() {
        authenticateAsService()
        whenever(contractService.call(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenReturn(ContractOutcome.error("PROVIDER_ERROR", "no such plan", "NOT_FOUND"))

        val response = call(ContractCallRequest(contract, "list"))

        assertThat(response.body!!.providerErrorCode).isEqualTo("NOT_FOUND")
        assertThat(response.body!!.errorCode).isEqualTo("PROVIDER_ERROR")
    }

    @Test
    fun `call is refused for user tokens and other principals`() {
        authenticateAsUser()
        assertThat(call(ContractCallRequest(contract, "list")).statusCode).isEqualTo(HttpStatus.FORBIDDEN)

        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken("admin", "n/a", listOf(SimpleGrantedAuthority("ROLE_ADMIN")))
        assertThat(call(ContractCallRequest(contract, "list")).statusCode).isEqualTo(HttpStatus.FORBIDDEN)

        SecurityContextHolder.clearContext()
        assertThat(call(ContractCallRequest(contract, "list")).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(contractService, never()).call(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
    }

    @Test
    fun `a body without contract or operation is a bad request`() {
        authenticateAsService()

        assertThat(call(ContractCallRequest(contract, " ")).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(resource.createJob(ContractJobCreateRequest(operation = "x"), null, null).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `a malformed chain or timeout header is a bad request`() {
        authenticateAsService()
        whenever(contractService.call(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenThrow(IllegalArgumentException("Malformed X-Valtimo-Contract-Timeout-Ms header"))

        val response = resource.call(ContractCallRequest(contract, "list"), null, "soon", null)

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(response.body!!.errorMessage).isEqualTo("Malformed X-Valtimo-Contract-Timeout-Ms header")
    }

    @Test
    fun `a service token creates a job without a user and gets 202`() {
        authenticateAsService()
        val jobId = UUID.randomUUID()
        stubCreate(ContractOutcome("accepted", jobId = jobId))

        val response = resource.createJob(
            ContractJobCreateRequest(contract, "generate", replyTo = "handle", idempotencyKey = "order-42"),
            null,
            "trace-1",
        )

        assertThat(response.statusCode).isEqualTo(HttpStatus.ACCEPTED)
        assertThat(response.body).isEqualTo(ContractResponse(status = "accepted", jobId = jobId))
        verify(jobService).create(
            eq(configurationId), eq(contract), eq("generate"), isNull(), eq("handle"), isNull(), eq("order-42"), isNull(),
            isNull(), eq("trace-1"),
        )
    }

    @Test
    fun `a user token creates a job on behalf of its user`() {
        authenticateAsUser()
        stubCreate(ContractOutcome("accepted", jobId = UUID.randomUUID()))

        resource.createJob(ContractJobCreateRequest(contract, "generate", documentId = "doc-1"), null, null)

        verify(jobService).create(
            eq(configurationId), eq(contract), eq("generate"), isNull(), isNull(), eq("doc-1"), isNull(), eq("jdoe"),
            isNull(), isNull(),
        )
    }

    @Test
    fun `a job request the rules refuse is a bad request with the reason`() {
        authenticateAsUser()
        whenever(
            jobService.create(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
        ).thenThrow(IllegalArgumentException("A user token must name the case it acts on (documentId)"))

        val response = resource.createJob(ContractJobCreateRequest(contract, "generate"), null, null)

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(response.body).isEqualTo(
            ContractResponse(status = "error", errorMessage = "A user token must name the case it acts on (documentId)")
        )
    }

    @Test
    fun `a rejected job request is a 200 error`() {
        authenticateAsService()
        stubCreate(ContractOutcome.error("NO_PROVIDER_BOUND", "none"))

        val response = resource.createJob(ContractJobCreateRequest(contract, "generate"), null, null)

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body!!.errorCode).isEqualTo("NO_PROVIDER_BOUND")
    }

    @Test
    fun `an idempotency conflict is a 200 error`() {
        authenticateAsService()
        stubCreate(ContractOutcome.error("IDEMPOTENCY_KEY_CONFLICT", "used"))

        val response = resource.createJob(ContractJobCreateRequest(contract, "generate", idempotencyKey = "k"), null, null)

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body!!.errorCode).isEqualTo("IDEMPOTENCY_KEY_CONFLICT")
    }

    @Test
    fun `completion maps ownership and state onto 200, 404, 409 and 400`() {
        authenticateAsService()
        val jobId = UUID.randomUUID()
        val request = ContractJobCompleteRequest("completed", objectMapper.createObjectNode())

        whenever(jobService.complete(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())).thenReturn(CompletionResult.Completed)
        resource.completeJob(jobId, request).let {
            assertThat(it.statusCode).isEqualTo(HttpStatus.OK)
            assertThat(it.body!!.status).isEqualTo("completed")
        }
        whenever(jobService.complete(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())).thenReturn(CompletionResult.NotFound)
        resource.completeJob(jobId, request).let {
            assertThat(it.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
            assertThat(it.body).isNull()
        }
        whenever(jobService.complete(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())).thenReturn(CompletionResult.Conflict)
        assertThat(resource.completeJob(jobId, request).statusCode).isEqualTo(HttpStatus.CONFLICT)
        whenever(jobService.complete(any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenReturn(CompletionResult.Invalid("PROVIDER_INVALID_RESULT", "missing"))
        assertThat(resource.completeJob(jobId, request).statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(jobService, org.mockito.kotlin.times(4)).complete(eq(configurationId), eq(jobId), eq("completed"), any(), isNull(), isNull())
    }

    @Test
    fun `completion and reads are service-token only`() {
        authenticateAsUser()

        assertThat(resource.completeJob(UUID.randomUUID(), ContractJobCompleteRequest("completed")).statusCode)
            .isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(resource.getJob(UUID.randomUUID()).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `a job the caller is no party to reads as not found`() {
        authenticateAsService()
        whenever(jobService.get(any(), any())).thenReturn(null)

        assertThat(resource.getJob(UUID.randomUUID()).statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    private fun call(request: ContractCallRequest) = resource.call(request, null, null, null)

    private fun stubCreate(outcome: ContractOutcome) {
        whenever(
            jobService.create(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull())
        ).thenReturn(outcome)
    }

    private fun authenticateAsService() {
        val principal = ExternalPluginServicePrincipal(configurationId, "pdca", "0.2.0")
        SecurityContextHolder.getContext().authentication = UsernamePasswordAuthenticationToken(principal, "token", emptyList())
    }

    private fun authenticateAsUser() {
        val principal = ExternalPluginUserPrincipal("jdoe", listOf("ROLE_USER"), configurationId)
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, "token", principal.authorities)
    }
}
