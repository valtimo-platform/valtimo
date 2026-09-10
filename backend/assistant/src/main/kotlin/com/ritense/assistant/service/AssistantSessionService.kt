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

package com.ritense.assistant.service

import com.ritense.assistant.domain.AssistantSessionEntity
import com.ritense.assistant.repository.AssistantMessageRepository
import com.ritense.assistant.repository.AssistantSessionRepository
import com.ritense.assistant.repository.PendingAssistantActionRepository
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

open class AssistantSessionService(
    private val sessionRepository: AssistantSessionRepository,
    private val messageRepository: AssistantMessageRepository,
    private val pendingActionRepository: PendingAssistantActionRepository
) {

    @Transactional
    open fun createSession(userId: String, title: String? = null): AssistantSessionEntity {
        val now = Instant.now()
        val session = AssistantSessionEntity(
            id = UUID.randomUUID(),
            userId = userId,
            title = title,
            createdAt = now,
            lastActivityAt = now
        )
        return sessionRepository.save(session)
    }

    @Transactional(readOnly = true)
    open fun getSession(sessionId: UUID, userId: String): AssistantSessionEntity? {
        return sessionRepository.findByIdAndUserId(sessionId, userId)
    }

    @Transactional(readOnly = true)
    open fun getSessions(userId: String, pageable: Pageable): Page<AssistantSessionEntity> {
        return sessionRepository.findByUserId(userId, pageable)
    }

    @Transactional
    open fun updateSessionTitle(sessionId: UUID, userId: String, title: String): AssistantSessionEntity? {
        val session = sessionRepository.findByIdAndUserId(sessionId, userId) ?: return null
        session.title = title
        return sessionRepository.save(session)
    }

    @Transactional
    open fun updateSessionActivity(sessionId: UUID) {
        sessionRepository.findById(sessionId).ifPresent { session ->
            session.updateActivity()
            sessionRepository.save(session)
        }
    }

    @Transactional(readOnly = true)
    open fun getLastPageContext(sessionId: UUID): String? {
        return sessionRepository.findById(sessionId)
            .map { it.lastPageContext }
            .orElse(null)
    }

    @Transactional
    open fun updatePageContext(sessionId: UUID, contextJson: String?) {
        sessionRepository.findById(sessionId).ifPresent { session ->
            session.updatePageContext(contextJson)
            sessionRepository.save(session)
        }
    }

    @Transactional
    open fun deleteSession(sessionId: UUID, userId: String): Boolean {
        val session = sessionRepository.findByIdAndUserId(sessionId, userId) ?: return false
        pendingActionRepository.deleteBySessionId(sessionId)
        messageRepository.deleteBySessionId(sessionId)
        sessionRepository.delete(session)
        return true
    }

    @Transactional
    open fun cleanupExpiredSessions(ttlSeconds: Long): Int {
        val cutoff = Instant.now().minusSeconds(ttlSeconds)
        return sessionRepository.deleteByLastActivityAtBefore(cutoff)
    }
}
