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

package com.ritense.externalplugin.repository

import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.ExternalPluginContractJob
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * Idempotency keys against a real database: a mocked repository compares with `==` and cannot show
 * the column collation. Runs on Postgres and MySQL (`integrationTesting{Postgresql,Mysql}`).
 */
@Transactional
class ExternalPluginContractJobRepositoryIntTest @Autowired constructor(
    private val jobRepository: ExternalPluginContractJobRepository,
) : BaseIntegrationTest() {

    @Test
    fun `idempotency keys that differ only in case are two keys`() {
        val requester = UUID.randomUUID()
        val upper = jobRepository.saveAndFlush(job(requester, "order-AB"))
        val lower = jobRepository.saveAndFlush(job(requester, "order-ab"))

        assertThat(jobRepository.findByRequesterConfigurationIdAndIdempotencyKey(requester, "order-AB")?.id)
            .isEqualTo(upper.id)
        assertThat(jobRepository.findByRequesterConfigurationIdAndIdempotencyKey(requester, "order-ab")?.id)
            .isEqualTo(lower.id)
    }

    @Test
    fun `the same idempotency key twice for one requester is rejected by the database`() {
        val requester = UUID.randomUUID()
        jobRepository.saveAndFlush(job(requester, "order-42"))

        assertThatThrownBy { jobRepository.saveAndFlush(job(requester, "order-42")) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    private fun job(requester: UUID, idempotencyKey: String) = ExternalPluginContractJob(
        id = UUID.randomUUID(),
        contract = "nl.ritense.document.generate@1",
        operation = "generate",
        requesterConfigurationId = requester,
        providerConfigurationId = UUID.randomUUID(),
        idempotencyKey = idempotencyKey,
        requestPayload = "{}",
        deadline = Instant.parse("2026-10-14T11:00:00Z"),
    )
}
