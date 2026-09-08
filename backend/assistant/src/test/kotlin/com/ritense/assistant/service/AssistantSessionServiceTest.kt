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
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.time.Instant
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AssistantSessionServiceTest {

    private lateinit var sessionRepository: AssistantSessionRepository
    private lateinit var messageRepository: AssistantMessageRepository
    private lateinit var pendingActionRepository: PendingAssistantActionRepository
    private lateinit var service: AssistantSessionService

    private val userId = "user123"

    @BeforeEach
    fun setUp() {
        sessionRepository = mock()
        messageRepository = mock()
        pendingActionRepository = mock()
        service = AssistantSessionService(sessionRepository, messageRepository, pendingActionRepository)
    }

    @Test
    fun `should create session for user`() {
        val captor = argumentCaptor<AssistantSessionEntity>()
        whenever(sessionRepository.save(captor.capture())).thenAnswer { captor.lastValue }

        val session = service.createSession(userId)

        assertNotNull(session)
        assertEquals(userId, session.userId)
        assertNull(session.title)
        assertNotNull(session.createdAt)
        assertNotNull(session.lastActivityAt)
    }

    @Test
    fun `should create session with title`() {
        val captor = argumentCaptor<AssistantSessionEntity>()
        whenever(sessionRepository.save(captor.capture())).thenAnswer { captor.lastValue }

        val session = service.createSession(userId, "My Chat")

        assertEquals("My Chat", session.title)
    }

    @Test
    fun `should get session by id and user`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, userId)
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(session)

        val result = service.getSession(sessionId, userId)

        assertNotNull(result)
        assertEquals(sessionId, result.id)
    }

    @Test
    fun `should return null when session not found`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(null)

        val result = service.getSession(sessionId, userId)

        assertNull(result)
    }

    @Test
    fun `should return null when session belongs to different user`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(null)

        val result = service.getSession(sessionId, userId)

        assertNull(result)
    }

    @Test
    fun `should get paginated sessions for user`() {
        val pageable = PageRequest.of(0, 20)
        val sessions = listOf(
            createSession(UUID.randomUUID(), userId),
            createSession(UUID.randomUUID(), userId)
        )
        whenever(sessionRepository.findByUserId(userId, pageable))
            .thenReturn(PageImpl(sessions, pageable, 2))

        val result = service.getSessions(userId, pageable)

        assertEquals(2, result.content.size)
        assertEquals(2, result.totalElements)
    }

    @Test
    fun `should update session title`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, userId)
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(session)
        whenever(sessionRepository.save(any())).thenAnswer { it.arguments[0] }

        val result = service.updateSessionTitle(sessionId, userId, "New Title")

        assertNotNull(result)
        assertEquals("New Title", result.title)
    }

    @Test
    fun `should return null when updating title for non-existent session`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(null)

        val result = service.updateSessionTitle(sessionId, userId, "New Title")

        assertNull(result)
        verify(sessionRepository, never()).save(any())
    }

    @Test
    fun `should update session activity`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, userId)
        val originalActivity = session.lastActivityAt
        whenever(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session))
        whenever(sessionRepository.save(any())).thenAnswer { it.arguments[0] }

        Thread.sleep(10)
        service.updateSessionActivity(sessionId)

        verify(sessionRepository).save(any())
    }

    @Test
    fun `should delete session with cascade`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, userId)
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(session)

        val result = service.deleteSession(sessionId, userId)

        assertTrue(result)
        verify(pendingActionRepository).deleteBySessionId(sessionId)
        verify(messageRepository).deleteBySessionId(sessionId)
        verify(sessionRepository).delete(session)
    }

    @Test
    fun `should return false when deleting non-existent session`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionRepository.findByIdAndUserId(sessionId, userId)).thenReturn(null)

        val result = service.deleteSession(sessionId, userId)

        assertFalse(result)
        verify(pendingActionRepository, never()).deleteBySessionId(any())
        verify(messageRepository, never()).deleteBySessionId(any())
        verify(sessionRepository, never()).delete(any())
    }

    @Test
    fun `should cleanup expired sessions`() {
        whenever(sessionRepository.deleteByLastActivityAtBefore(any())).thenReturn(5)

        val deleted = service.cleanupExpiredSessions(3600)

        assertEquals(5, deleted)
    }

    private fun createSession(id: UUID, userId: String): AssistantSessionEntity {
        val now = Instant.now()
        return AssistantSessionEntity(
            id = id,
            userId = userId,
            title = null,
            createdAt = now,
            lastActivityAt = now
        )
    }
}
