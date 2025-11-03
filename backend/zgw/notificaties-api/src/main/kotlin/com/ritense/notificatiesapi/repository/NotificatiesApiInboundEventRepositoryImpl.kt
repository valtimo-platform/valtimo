/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi.repository

import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.slf4j.LoggerFactory
import java.time.LocalDateTime

class NotificatiesApiInboundEventRepositoryImpl(
    @PersistenceContext private val entityManager: EntityManager
) : NotificatiesApiInboundEventRepositoryCustom {

    private val logger = LoggerFactory.getLogger(javaClass)

    override fun fetchNextBatchForProcessing(limit: Int): List<NotificatiesApiInboundEvent> {
        if (limit <= 0) {
            logger.debug("fetchNextBatchForProcessing invoked with non-positive limit {}", limit)
            return emptyList()
        }

        val sql = """
            SELECT *
            FROM notificaties_api_inbound_event
            WHERE next_due_at IS NOT NULL
              AND next_due_at <= :now
            ORDER BY next_due_at
            LIMIT :limit FOR UPDATE SKIP LOCKED
        """.trimIndent()

        val query = entityManager.createNativeQuery(sql, NotificatiesApiInboundEvent::class.java)
        query.setParameter("now", LocalDateTime.now())
        query.setParameter("limit", limit)

        @Suppress("UNCHECKED_CAST")
        return query.resultList as List<NotificatiesApiInboundEvent>
    }
}
