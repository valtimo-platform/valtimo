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
import com.ritense.externalplugin.service.ExternalPluginContractJobService.CompletionResult
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Assertions.assertTimeoutPreemptively
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Duration

/** ReDoS and broken schemas on the job paths: create, `complete` (outside the row lock) and the dispatcher. */
class ExternalPluginContractSchemaHardeningTest {

    private val redos = "(.*a){8}\$"
    private val hostile = "a".repeat(60) + "!"

    private fun manifest(output: String) = ContractJobFixture().objectMapper.readTree(
        """
        {"provides": [{"contract": "nl.ritense.document.generate@1", "operations": [
            {"key": "generate", "mode": "job", "timeout": "PT2H", "output": $output}
        ]}]}
        """.trimIndent()
    ) as ObjectNode

    private fun redosFixture() = ContractJobFixture(
        providerManifest = manifest("""{"type":"object","properties":{"x":{"pattern":"$redos"}}}"""),
    )

    @Test
    fun `complete cuts a catastrophic output pattern off and fails the job`() {
        val fixture = redosFixture()
        val jobId = fixture.createAccepted("generate")
        val result = fixture.objectMapper.createObjectNode().put("x", hostile)

        val completion = assertTimeoutPreemptively<CompletionResult>(Duration.ofSeconds(2)) {
            fixture.jobService.complete(fixture.provider.id, jobId, "completed", result, null, null)
        }

        assertThat(completion).isInstanceOf(CompletionResult.Invalid::class.java)
        assertThat((completion as CompletionResult.Invalid).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
        assertThat(fixture.job(jobId).status).isNotEqualTo(ExternalPluginContractJobStatus.ACCEPTED)
        assertThat(fixture.job(jobId).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `complete validates before it takes the row lock`() {
        val fixture = redosFixture()
        val jobId = fixture.createAccepted("generate")
        val result = fixture.objectMapper.createObjectNode().put("x", hostile)
        var nanosAtLock = 0L
        val original = fixture.jobRepository.findByIdForUpdate(jobId)
        whenever(fixture.jobRepository.findByIdForUpdate(any())).thenAnswer {
            nanosAtLock = System.nanoTime()
            original
        }

        val started = System.nanoTime()
        fixture.jobService.complete(fixture.provider.id, jobId, "completed", result, null, null)

        assertThat(Duration.ofNanos(nanosAtLock - started)).isGreaterThan(Duration.ofMillis(100))
        inOrder(fixture.jobRepository) {
            verify(fixture.jobRepository).findById(jobId)
            verify(fixture.jobRepository).findByIdForUpdate(jobId)
        }
    }

    @Test
    fun `a job that expires between the unlocked read and the lock is a conflict and is not finished`() {
        val fixture = ContractJobFixture()
        val jobId = fixture.createAccepted("generate")
        val job = fixture.job(jobId)
        whenever(fixture.jobRepository.findByIdForUpdate(any())).thenAnswer {
            job.status = ExternalPluginContractJobStatus.EXPIRED
            job
        }
        val result = fixture.objectMapper.createObjectNode().put("documentRef", "r").put("contentHash", "h")

        val completion = fixture.jobService.complete(fixture.provider.id, jobId, "completed", result, null, null)

        assertThat(completion).isEqualTo(CompletionResult.Conflict)
        assertThat(job.resultPayload).isNull()
        verify(fixture.jobRepository, never()).save(any())
    }

    @Test
    fun `the dispatcher fails a job whose provider answers with a catastrophic result`() {
        val fixture = redosFixture()
        val jobId = fixture.createAccepted("generate")
        fixture.providerAnswers(200, """{"status":"completed","result":{"x":"$hostile"}}""")

        assertTimeoutPreemptively<Unit>(Duration.ofSeconds(2)) { fixture.dispatcher.dispatch() }

        assertThat(fixture.job(jobId).errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
    }

    @Test
    fun `job create refuses an uncompilable output schema and stores nothing`() {
        val fixture = ContractJobFixture(providerManifest = manifest("""{"type":"object","pattern":"["}"""))

        val outcome = fixture.create("generate")

        assertThat(outcome.errorCode).isEqualTo("PROVIDER_INVALID_RESULT")
        assertThat(outcome.errorMessage).contains("declares an invalid output schema")
        assertThat(fixture.jobs).isEmpty()
    }
}
