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

import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import com.ritense.externalplugin.domain.ExternalPluginContractJobStatus
import com.ritense.externalplugin.repository.ExternalPluginContractJobRepository
import com.ritense.plugin.service.EncryptionService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * BPMN replies against the real process engine: the subscription queries, the expression-named catch
 * event a modeller uses to tell parallel jobs apart, and the `contractReply` variable it receives.
 */
@Transactional
class ExternalPluginContractBpmnReplyIntTest @Autowired constructor(
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val historyService: HistoryService,
    private val jobRepository: ExternalPluginContractJobRepository,
    private val dispatcher: ExternalPluginContractJobDispatcher,
    private val encryptionService: EncryptionService,
) : BaseIntegrationTest() {

    private val contract = "nl.ritense.document.generate@1"

    @Test
    fun `a catch event named after the job id receives the reply`() {
        val jobId = UUID.randomUUID()
        val processInstanceId = startWaitingFor("contract-reply:\${contractJobId}", jobId)
        val variablesBefore = variableNames(processInstanceId)

        dispatcher.deliverReplies()

        assertThat(job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(waiting(processInstanceId, "contract-reply:$jobId")).isZero()
        assertThat(waiting(processInstanceId, "hold")).isEqualTo(1)
        @Suppress("UNCHECKED_CAST")
        val reply = variable(processInstanceId, "contractReply") as Map<String, Any?>
        assertThat(reply).containsEntry("jobId", jobId.toString())
            .containsEntry("contract", contract)
            .containsEntry("operation", "generate")
            .containsEntry("status", "completed")
            .doesNotContainKeys("errorCode", "providerErrorCode", "errorMessage")
        @Suppress("UNCHECKED_CAST")
        assertThat(reply["result"] as Map<String, Any?>).containsEntry("documentRef", "https://docs/1")
        assertThat(variableNames(processInstanceId) - variablesBefore.toSet()).containsExactly("contractReply")
    }

    @Test
    fun `a catch event named after the contract operation receives the reply`() {
        val jobId = UUID.randomUUID()
        val processInstanceId = startWaitingFor("contract-reply:$contract:generate", jobId)

        dispatcher.deliverReplies()

        assertThat(job(jobId).status).isEqualTo(ExternalPluginContractJobStatus.DELIVERED)
        assertThat(waiting(processInstanceId, "hold")).isEqualTo(1)
    }

    @Test
    fun `a reply nobody waits for stays queued with the reason`() {
        val jobId = UUID.randomUUID()
        val processInstanceId = startWaitingFor("something-else", jobId)

        dispatcher.deliverReplies()

        val job = job(jobId)
        assertThat(job.status).isEqualTo(ExternalPluginContractJobStatus.COMPLETED)
        assertThat(job.deliveryAttempts).isEqualTo(1)
        assertThat(job.lastDeliveryError).isEqualTo(
            "No execution of process instance $processInstanceId waits for message 'contract-reply:$contract:generate'"
        )
    }

    private fun startWaitingFor(messageName: String, jobId: UUID): String {
        val processKey = "contract-reply-${UUID.randomUUID()}"
        val model = Bpmn.createExecutableProcess(processKey)
            .startEvent()
            .intermediateCatchEvent("wait-for-reply").message(messageName)
            .intermediateCatchEvent("hold").message("hold")
            .endEvent()
            .done()
        repositoryService.createDeployment().addModelInstance("$processKey.bpmn", model).deploy()
        val processInstanceId = runtimeService.startProcessInstanceByKey(processKey, mapOf("contractJobId" to jobId.toString())).id
        jobRepository.saveAndFlush(
            ExternalPluginContractJob(
                id = jobId,
                contract = contract,
                operation = "generate",
                requesterConfigurationId = UUID.randomUUID(),
                providerConfigurationId = UUID.randomUUID(),
                status = ExternalPluginContractJobStatus.COMPLETED,
                outcome = ExternalPluginContractJobStatus.COMPLETED,
                requestPayload = encryptionService.encrypt("{}"),
                resultPayload = encryptionService.encrypt("""{"documentRef":"https://docs/1"}"""),
                replyToProcessInstanceId = processInstanceId,
                deadline = Instant.now().plusSeconds(3600),
                nextAttemptAt = Instant.now().minusSeconds(1),
            )
        )
        return processInstanceId
    }

    private fun waiting(processInstanceId: String, messageName: String): Long =
        runtimeService.createEventSubscriptionQuery()
            .processInstanceId(processInstanceId)
            .eventType("message")
            .eventName(messageName)
            .count()

    private fun variable(processInstanceId: String, name: String): Any? =
        historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .variableName(name)
            .singleResult()
            ?.value

    private fun variableNames(processInstanceId: String): List<String> =
        historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .list()
            .map { it.name }

    private fun job(id: UUID): ExternalPluginContractJob = jobRepository.findById(id).orElseThrow()
}
