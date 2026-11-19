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

import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_SELF
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.runtime.EventSubscriptionQuery
import org.operaton.bpm.engine.runtime.MessageCorrelationBuilder
import java.lang.reflect.Proxy
import java.util.UUID

/** Replies to a job requested with a reply handle go to that process instance as a BPMN message. */
class ExternalPluginContractJobBpmnReplyTest {

    private val fixture = ContractJobFixture()
    private val runtimeService = fixture.runtimeService
    private val genericMessage = "contract-reply:${fixture.contract}:generate"

    /** Waiting executions per (process instance, message name). */
    private val subscriptions = mutableMapOf<Pair<String, String>, Long>()
    private val correlation = mock<MessageCorrelationBuilder>(defaultAnswer = RETURNS_SELF)

    @BeforeEach
    fun setUp() {
        whenever(runtimeService.createEventSubscriptionQuery()).thenAnswer { subscriptionQuery() }
        whenever(runtimeService.createMessageCorrelation(any())).thenReturn(correlation)
    }

    @Test
    fun `a catch event waiting for the job's own message gets the reply`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-1" to "contract-reply:$jobId"] = 1
        subscriptions["pi-1" to genericMessage] = 1

        fixture.dispatcher.deliverReplies()

        verify(runtimeService).createMessageCorrelation("contract-reply:$jobId")
        verify(runtimeService, never()).createMessageCorrelation(genericMessage)
        verify(correlation).processInstanceId("pi-1")
        verify(correlation).correlateWithResult()
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        verify(fixture.hostClient, never()).invokeContractReply(any(), any(), any(), any(), any(), anyOrNull())
    }

    @Test
    fun `without a job-specific catch the generic contract message is correlated`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-1" to genericMessage] = 1

        fixture.dispatcher.deliverReplies()

        verify(runtimeService).createMessageCorrelation(genericMessage)
        verify(correlation).processInstanceId("pi-1")
        assertThat(fixture.job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
    }

    @Test
    fun `the reply is one local variable, contractReply, without null entries`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-1" to genericMessage] = 1

        fixture.dispatcher.deliverReplies()

        val variables = argumentCaptor<Map<String, Any>>()
        verify(correlation).setVariablesLocal(variables.capture())
        verify(correlation, never()).setVariables(any())
        assertThat(variables.firstValue.keys).containsExactly("contractReply")
        @Suppress("UNCHECKED_CAST")
        val reply = variables.firstValue["contractReply"] as Map<String, Any?>
        assertThat(reply).containsOnlyKeys("jobId", "contract", "operation", "status", "result")
        assertThat(reply["jobId"]).isEqualTo(jobId.toString())
        assertThat(reply["contract"]).isEqualTo(fixture.contract)
        assertThat(reply["operation"]).isEqualTo("generate")
        assertThat(reply["status"]).isEqualTo("completed")
        @Suppress("UNCHECKED_CAST")
        assertThat(reply["result"] as Map<String, Any?>).containsEntry("documentRef", "r")
    }

    @Test
    fun `a failed job replies its codes`() {
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, "pi-1", null)
        val jobId = fixture.createAccepted("generate", replyTo = handle)
        fixture.jobService.complete(fixture.provider.id, jobId, "failed", null, "TEMPLATE_MISSING", "no template")
        subscriptions["pi-1" to genericMessage] = 1

        fixture.dispatcher.deliverReplies()

        val variables = argumentCaptor<Map<String, Any>>()
        verify(correlation).setVariablesLocal(variables.capture())
        @Suppress("UNCHECKED_CAST")
        val reply = variables.firstValue["contractReply"] as Map<String, Any?>
        assertThat(reply["status"]).isEqualTo("failed")
        assertThat(reply["errorCode"]).isEqualTo("PROVIDER_ERROR")
        assertThat(reply["providerErrorCode"]).isEqualTo("TEMPLATE_MISSING")
        assertThat(reply["errorMessage"]).isEqualTo("no template")
        assertThat(reply).doesNotContainKey("result")
    }

    @Test
    fun `a reply nobody waits for yet is retried`() {
        val jobId = completedJobReplyingTo("pi-1")

        fixture.dispatcher.deliverReplies()

        val job = fixture.job(jobId)
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(job.deliveryAttempts).isEqualTo(1)
        assertThat(job.lastDeliveryError).isEqualTo("No execution of process instance pi-1 waits for message '$genericMessage'")
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `several executions waiting for the same name are ambiguous`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-1" to genericMessage] = 2

        fixture.dispatcher.deliverReplies()

        assertThat(fixture.job(jobId).lastDeliveryError).isEqualTo(
            "Several executions of process instance pi-1 wait for '$genericMessage'; name each catch event's message " +
                "'contract-reply:\${<variable holding the job id>}' to tell them apart"
        )
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `executions of other process instances never receive the reply`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-2" to genericMessage] = 1

        fixture.dispatcher.deliverReplies()

        assertThat(fixture.job(jobId).deliveryAttempts).isEqualTo(1)
        verify(runtimeService, never()).createMessageCorrelation(any())
    }

    @Test
    fun `a correlation that throws counts as a failed attempt`() {
        val jobId = completedJobReplyingTo("pi-1")
        subscriptions["pi-1" to genericMessage] = 1
        whenever(correlation.correlateWithResult()).thenThrow(IllegalStateException("engine says no"))

        fixture.dispatcher.deliverReplies()

        assertThat(fixture.job(jobId).deliveryAttempts).isEqualTo(1)
        assertThat(fixture.job(jobId).lastDeliveryError).contains("engine says no")
    }

    private fun completedJobReplyingTo(processInstanceId: String): UUID {
        val handle = fixture.replyHandleSigner.issue(fixture.requester.id, processInstanceId, UUID.randomUUID().toString())
        val jobId = fixture.createAccepted("generate", replyTo = handle)
        fixture.jobService.complete(
            fixture.provider.id,
            jobId,
            "completed",
            fixture.objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h"),
            null,
            null,
        )
        return jobId
    }

    /** Answers `count()` from [subscriptions] for the process instance and name the query was narrowed to. */
    private fun subscriptionQuery(): EventSubscriptionQuery {
        var processInstanceId: String? = null
        var eventName: String? = null
        var eventType: String? = null
        return Proxy.newProxyInstance(
            javaClass.classLoader,
            arrayOf(EventSubscriptionQuery::class.java),
        ) { proxy, method, args ->
            when (method.name) {
                "processInstanceId" -> proxy.also { processInstanceId = args[0] as String }
                "eventName" -> proxy.also { eventName = args[0] as String }
                "eventType" -> proxy.also { eventType = args[0] as String }
                "count" -> if (eventType == "message") subscriptions[processInstanceId!! to eventName!!] ?: 0L else 0L
                else -> throw UnsupportedOperationException(method.name)
            }
        } as EventSubscriptionQuery
    }
}
