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

package com.ritense.assistant.repository

import com.ritense.assistant.domain.AssistantMessageEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface AssistantMessageRepository : JpaRepository<AssistantMessageEntity, UUID> {

    fun findBySessionIdOrderByCreatedAtAsc(sessionId: UUID): List<AssistantMessageEntity>

    @Modifying
    @Query("DELETE FROM AssistantMessageEntity m WHERE m.sessionId = :sessionId")
    fun deleteBySessionId(sessionId: UUID)

    @Modifying
    @Query("DELETE FROM AssistantMessageEntity m WHERE m.sessionId IN (SELECT s.id FROM AssistantSessionEntity s WHERE s.userId = :userId)")
    fun deleteByUserId(userId: String)
}
