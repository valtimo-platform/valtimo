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

package com.ritense.outbox.golden

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.outbox.BaseIntegrationTest
import com.ritense.outbox.OutboxService
import com.ritense.outbox.domain.BaseEvent
import com.ritense.valtimo.test.golden.GoldenJson
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

class CloudEventGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var outboxService: OutboxService

    @Test
    @Transactional
    fun `the stored cloud event keeps its envelope and data`() {
        val payload = objectMapper.valueToTree<ObjectNode>(
            GoldenPayload(
                name = "Zoë Çelik ✓",
                amount = BigDecimal("12.50"),
                count = 3,
                createdOn = LocalDateTime.of(2026, 1, 2, 3, 4, 5, 600_000_000),
                decidedAt = OffsetDateTime.of(2026, 1, 2, 3, 4, 5, 0, ZoneOffset.ofHours(1)),
                dueDate = LocalDate.of(2026, 2, 3),
                nothing = null,
                tags = listOf("a", "b"),
                nested = mapOf("key" to mapOf("deep" to 1)),
            )
        )

        outboxService.send { GoldenEvent(payload) }

        GoldenJson.assertMatchesGolden(javaClass, "cloud-event", outboxMessageRepository.findAll().single().message)
    }

    data class GoldenPayload(
        val name: String,
        val amount: BigDecimal,
        val count: Long,
        val createdOn: LocalDateTime,
        val decidedAt: OffsetDateTime,
        val dueDate: LocalDate,
        val nothing: String?,
        val tags: List<String>,
        val nested: Map<String, Any>,
    )

    class GoldenEvent(payload: ObjectNode) : BaseEvent(
        id = UUID.fromString("3f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11"),
        type = "com.ritense.golden.created",
        date = LocalDateTime.of(2026, 11, 26, 10, 15, 30, 123_000_000),
        userId = "golden-user",
        roles = setOf("ROLE_USER"),
        resultType = "com.ritense.Golden",
        resultId = "golden-1",
        result = payload,
    )
}
