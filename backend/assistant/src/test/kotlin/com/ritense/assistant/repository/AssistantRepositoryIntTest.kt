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

import com.ritense.assistant.BaseIntegrationTest
import com.ritense.assistant.domain.AssistantMessageEntity
import com.ritense.assistant.domain.AssistantSessionEntity
import com.ritense.assistant.domain.MessageRole
import com.ritense.assistant.domain.PendingAssistantAction
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

@Transactional
class AssistantRepositoryIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var sessionRepository: AssistantSessionRepository

    @Autowired
    lateinit var messageRepository: AssistantMessageRepository

    @Autowired
    lateinit var pendingActionRepository: PendingAssistantActionRepository

    private val userId = "test-user"

    @BeforeEach
    fun setUp() {
        pendingActionRepository.deleteAll()
        messageRepository.deleteAll()
        sessionRepository.deleteAll()
    }

    @Test
    fun `should persist and retrieve session`() {
        val session = createSession(userId, "Test Session")
        sessionRepository.save(session)

        val found = sessionRepository.findById(session.id)

        assertTrue(found.isPresent)
        assertEquals("Test Session", found.get().title)
        assertEquals(userId, found.get().userId)
    }

    @Test
    fun `should find session by id and userId`() {
        val session = createSession(userId, "My Session")
        sessionRepository.save(session)

        val found = sessionRepository.findByIdAndUserId(session.id, userId)

        assertNotNull(found)
        assertEquals(session.id, found.id)
    }

    @Test
    fun `should return null for session with different userId`() {
        val session = createSession(userId, "My Session")
        sessionRepository.save(session)

        val found = sessionRepository.findByIdAndUserId(session.id, "other-user")

        assertNull(found)
    }

    @Test
    fun `should find sessions by userId with pagination`() {
        repeat(5) { i ->
            sessionRepository.save(createSession(userId, "Session $i"))
        }
        sessionRepository.save(createSession("other-user", "Other Session"))

        val pageable = PageRequest.of(0, 3, Sort.by("createdAt").descending())
        val page = sessionRepository.findByUserId(userId, pageable)

        assertEquals(3, page.content.size)
        assertEquals(5, page.totalElements)
        assertEquals(2, page.totalPages)
    }

    @Test
    fun `should persist messages with session`() {
        val session = createSession(userId)
        sessionRepository.save(session)

        val message1 = createMessage(session.id, MessageRole.USER, "Hello")
        val message2 = createMessage(session.id, MessageRole.AI, "Hi there!")
        messageRepository.saveAll(listOf(message1, message2))

        val messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.id)

        assertEquals(2, messages.size)
        assertEquals("Hello", messages[0].content)
        assertEquals("Hi there!", messages[1].content)
    }

    @Test
    fun `should delete messages by sessionId`() {
        val session = createSession(userId)
        sessionRepository.save(session)
        messageRepository.save(createMessage(session.id, MessageRole.USER, "Test"))

        messageRepository.deleteBySessionId(session.id)

        val messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(session.id)
        assertTrue(messages.isEmpty())
    }

    @Test
    fun `should persist pending action with expiration`() {
        val session = createSession(userId)
        sessionRepository.save(session)

        val action = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = session.id,
            userId = userId,
            tool = "apply_case_definition_change",
            params = """{"key": "value"}""",
            resourceType = "CaseDefinition",
            resourceId = "loan-case",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )
        pendingActionRepository.save(action)

        val found = pendingActionRepository.findByIdAndUserId(action.id, userId)

        assertNotNull(found)
        assertEquals("apply_case_definition_change", found.tool)
        assertEquals("CaseDefinition", found.resourceType)
    }

    @Test
    fun `should find pending action by id and userId`() {
        val session = createSession(userId)
        sessionRepository.save(session)
        val action = createPendingAction(session.id, userId)
        pendingActionRepository.save(action)

        val found = pendingActionRepository.findByIdAndUserId(action.id, userId)

        assertNotNull(found)
    }

    @Test
    fun `should return null for pending action with different userId`() {
        val session = createSession(userId)
        sessionRepository.save(session)
        val action = createPendingAction(session.id, userId)
        pendingActionRepository.save(action)

        val found = pendingActionRepository.findByIdAndUserId(action.id, "other-user")

        assertNull(found)
    }

    @Test
    fun `should delete expired pending actions`() {
        val session = createSession(userId)
        sessionRepository.save(session)

        val expiredAction = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = session.id,
            userId = userId,
            tool = "test",
            params = "{}",
            createdAt = Instant.now().minusSeconds(600),
            expiresAt = Instant.now().minusSeconds(300)
        )
        val validAction = createPendingAction(session.id, userId)
        pendingActionRepository.saveAll(listOf(expiredAction, validAction))

        val deleted = pendingActionRepository.deleteExpiredBefore(Instant.now())

        assertEquals(1, deleted)
        assertNull(pendingActionRepository.findByIdAndUserId(expiredAction.id, userId))
        assertNotNull(pendingActionRepository.findByIdAndUserId(validAction.id, userId))
    }

    @Test
    fun `should delete pending actions by sessionId`() {
        val session = createSession(userId)
        sessionRepository.save(session)
        pendingActionRepository.save(createPendingAction(session.id, userId))
        pendingActionRepository.save(createPendingAction(session.id, userId))

        pendingActionRepository.deleteBySessionId(session.id)

        assertEquals(0, pendingActionRepository.count())
    }

    @Test
    fun `should delete old sessions`() {
        val oldSession = AssistantSessionEntity(
            id = UUID.randomUUID(),
            userId = userId,
            title = "Old",
            createdAt = Instant.now().minusSeconds(7200),
            lastActivityAt = Instant.now().minusSeconds(7200)
        )
        val recentSession = createSession(userId, "Recent")
        sessionRepository.saveAll(listOf(oldSession, recentSession))

        val deleted = sessionRepository.deleteByLastActivityAtBefore(Instant.now().minusSeconds(3600))

        assertEquals(1, deleted)
        assertNull(sessionRepository.findByIdAndUserId(oldSession.id, userId))
        assertNotNull(sessionRepository.findByIdAndUserId(recentSession.id, userId))
    }

    private fun createSession(userId: String, title: String? = null): AssistantSessionEntity {
        val now = Instant.now()
        return AssistantSessionEntity(
            id = UUID.randomUUID(),
            userId = userId,
            title = title,
            createdAt = now,
            lastActivityAt = now
        )
    }

    private fun createMessage(sessionId: UUID, role: MessageRole, content: String): AssistantMessageEntity {
        return AssistantMessageEntity(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            role = role,
            content = content,
            createdAt = Instant.now()
        )
    }

    private fun createPendingAction(sessionId: UUID, userId: String): PendingAssistantAction {
        return PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = userId,
            tool = "test_tool",
            params = "{}",
            createdAt = Instant.now(),
            expiresAt = Instant.now().plusSeconds(300)
        )
    }
}
