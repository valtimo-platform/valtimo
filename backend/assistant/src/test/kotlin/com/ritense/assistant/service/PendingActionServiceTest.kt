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

import com.ritense.assistant.domain.PendingAssistantAction
import com.ritense.assistant.repository.PendingAssistantActionRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class PendingActionServiceTest {

    private lateinit var repository: PendingAssistantActionRepository
    private lateinit var executor: ActionExecutor
    private lateinit var service: PendingActionService

    private val sessionId = UUID.randomUUID()
    private val userId = "user123"
    private val tool = "apply_case_definition_change"
    private val params = """{"key": "value"}"""

    @BeforeEach
    fun setUp() {
        repository = mock()
        executor = mock()
        service = PendingActionService(
            repository,
            mapOf(tool to executor)
        )
    }

    @Test
    fun `should create pending action with default TTL`() {
        val captor = argumentCaptor<PendingAssistantAction>()
        whenever(repository.save(captor.capture())).thenAnswer { captor.lastValue }

        val result = service.createPendingAction(
            sessionId = sessionId,
            userId = userId,
            tool = tool,
            params = params
        )

        val saved = captor.lastValue
        assertNotNull(saved.id)
        assertEquals(sessionId, saved.sessionId)
        assertEquals(userId, saved.userId)
        assertEquals(tool, saved.tool)
        assertEquals(params, saved.params)
        assertNotNull(saved.createdAt)
        assertTrue(saved.expiresAt.isAfter(saved.createdAt))

        val expectedExpiration = saved.createdAt.plus(PendingActionService.DEFAULT_TTL)
        assertEquals(expectedExpiration.epochSecond, saved.expiresAt.epochSecond)
    }

    @Test
    fun `should create pending action with custom TTL`() {
        val customTtl = Duration.ofMinutes(10)
        val captor = argumentCaptor<PendingAssistantAction>()
        whenever(repository.save(captor.capture())).thenAnswer { captor.lastValue }

        service.createPendingAction(
            sessionId = sessionId,
            userId = userId,
            tool = tool,
            params = params,
            ttl = customTtl
        )

        val saved = captor.lastValue
        val expectedExpiration = saved.createdAt.plus(customTtl)
        assertEquals(expectedExpiration.epochSecond, saved.expiresAt.epochSecond)
    }

    @Test
    fun `should create pending action with resource info`() {
        val captor = argumentCaptor<PendingAssistantAction>()
        whenever(repository.save(captor.capture())).thenAnswer { captor.lastValue }

        service.createPendingAction(
            sessionId = sessionId,
            userId = userId,
            tool = tool,
            params = params,
            resourceType = "CaseDefinition",
            resourceId = "loan-application:1.0.0"
        )

        val saved = captor.lastValue
        assertEquals("CaseDefinition", saved.resourceType)
        assertEquals("loan-application:1.0.0", saved.resourceId)
    }

    @Test
    fun `should confirm action and execute`() {
        val actionId = UUID.randomUUID()
        val action = createAction(actionId, expiresAt = Instant.now().plusSeconds(300))
        val executionResult = mapOf("status" to "success")

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(action)
        whenever(executor.execute(params, userId)).thenReturn(executionResult)

        val result = service.confirmAction(actionId, userId)

        assertIs<ActionResult.Success>(result)
        assertEquals(executionResult, result.result)
        verify(executor).execute(params, userId)
        verify(repository).delete(action)
    }

    @Test
    fun `should return NotFound when action does not exist`() {
        val actionId = UUID.randomUUID()
        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(null)

        val result = service.confirmAction(actionId, userId)

        assertIs<ActionResult.NotFound>(result)
        verify(executor, never()).execute(any(), any())
    }

    @Test
    fun `should return Expired when action is past expiration`() {
        val actionId = UUID.randomUUID()
        val expiredAction = createAction(actionId, expiresAt = Instant.now().minusSeconds(60))

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(expiredAction)

        val result = service.confirmAction(actionId, userId)

        assertIs<ActionResult.Expired>(result)
        verify(executor, never()).execute(any(), any())
        verify(repository).delete(expiredAction)
    }

    @Test
    fun `should return Error when executor not found`() {
        val actionId = UUID.randomUUID()
        val unknownTool = "unknown_tool"
        val action = createAction(actionId, tool = unknownTool, expiresAt = Instant.now().plusSeconds(300))

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(action)

        val result = service.confirmAction(actionId, userId)

        assertIs<ActionResult.Error>(result)
        assertEquals("Unknown action type: $unknownTool", result.message)
    }

    @Test
    fun `should return Error when executor throws exception`() {
        val actionId = UUID.randomUUID()
        val action = createAction(actionId, expiresAt = Instant.now().plusSeconds(300))
        val errorMessage = "Database connection failed"

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(action)
        whenever(executor.execute(params, userId)).thenThrow(RuntimeException(errorMessage))

        val result = service.confirmAction(actionId, userId)

        assertIs<ActionResult.Error>(result)
        assertEquals(errorMessage, result.message)
    }

    @Test
    fun `should cancel action`() {
        val actionId = UUID.randomUUID()
        val action = createAction(actionId, expiresAt = Instant.now().plusSeconds(300))

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(action)

        val result = service.cancelAction(actionId, userId)

        assertTrue(result)
        verify(repository).delete(action)
        verify(executor, never()).execute(any(), any())
    }

    @Test
    fun `should return false when canceling non-existent action`() {
        val actionId = UUID.randomUUID()
        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(null)

        val result = service.cancelAction(actionId, userId)

        assertFalse(result)
    }

    @Test
    fun `should get pending action for user`() {
        val actionId = UUID.randomUUID()
        val action = createAction(actionId, expiresAt = Instant.now().plusSeconds(300))

        whenever(repository.findByIdAndUserId(actionId, userId)).thenReturn(action)

        val result = service.getPendingAction(actionId, userId)

        assertEquals(action, result)
    }

    @Test
    fun `should return null when getting action for different user`() {
        val actionId = UUID.randomUUID()
        val differentUser = "other-user"

        whenever(repository.findByIdAndUserId(actionId, differentUser)).thenReturn(null)

        val result = service.getPendingAction(actionId, differentUser)

        assertEquals(null, result)
    }

    @Test
    fun `should cleanup expired actions`() {
        whenever(repository.deleteExpiredBefore(any())).thenReturn(5)

        val result = service.cleanupExpiredActions()

        assertEquals(5, result)
        verify(repository).deleteExpiredBefore(any())
    }

    private fun createAction(
        id: UUID,
        tool: String = this.tool,
        expiresAt: Instant
    ) = PendingAssistantAction(
        id = id,
        sessionId = sessionId,
        userId = userId,
        tool = tool,
        params = params,
        resourceType = null,
        resourceId = null,
        createdAt = Instant.now().minusSeconds(60),
        expiresAt = expiresAt
    )
}
