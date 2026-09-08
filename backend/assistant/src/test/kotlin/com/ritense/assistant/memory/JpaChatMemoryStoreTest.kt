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

package com.ritense.assistant.memory

import com.ritense.assistant.domain.AssistantMessageEntity
import com.ritense.assistant.domain.MessageRole
import com.ritense.assistant.repository.AssistantMessageRepository
import dev.langchain4j.data.message.AiMessage
import dev.langchain4j.data.message.SystemMessage
import dev.langchain4j.data.message.ToolExecutionResultMessage
import dev.langchain4j.data.message.UserMessage
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class JpaChatMemoryStoreTest {

    private lateinit var repository: AssistantMessageRepository
    private lateinit var store: JpaChatMemoryStore

    private val sessionId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        repository = mock()
        store = JpaChatMemoryStore(repository)
    }

    @Test
    fun `should get messages in order`() {
        val messages = listOf(
            createMessageEntity(MessageRole.SYSTEM, "System prompt"),
            createMessageEntity(MessageRole.USER, "Hello"),
            createMessageEntity(MessageRole.AI, "Hi there!")
        )
        whenever(repository.findBySessionIdOrderByCreatedAtAsc(sessionId)).thenReturn(messages)

        val result = store.getMessages(sessionId)

        assertEquals(3, result.size)
        assertIs<SystemMessage>(result[0])
        assertIs<UserMessage>(result[1])
        assertIs<AiMessage>(result[2])
        assertEquals("System prompt", (result[0] as SystemMessage).text())
        assertEquals("Hello", (result[1] as UserMessage).singleText())
        assertEquals("Hi there!", (result[2] as AiMessage).text())
    }

    @Test
    fun `should get messages with UUID string as memoryId`() {
        val stringId = sessionId.toString()
        whenever(repository.findBySessionIdOrderByCreatedAtAsc(sessionId)).thenReturn(emptyList())

        store.getMessages(stringId)

        verify(repository).findBySessionIdOrderByCreatedAtAsc(sessionId)
    }

    @Test
    fun `should return empty list for unknown memoryId`() {
        whenever(repository.findBySessionIdOrderByCreatedAtAsc(any())).thenReturn(emptyList())

        val result = store.getMessages(sessionId)

        assertTrue(result.isEmpty())
    }

    @Test
    fun `should throw for invalid memoryId type`() {
        assertThrows<IllegalArgumentException> {
            store.getMessages(12345)
        }
    }

    @Test
    fun `should update messages by replacing all`() {
        val messages = listOf(
            UserMessage.from("Hello"),
            AiMessage.from("Hi!")
        )
        val captor = argumentCaptor<List<AssistantMessageEntity>>()

        store.updateMessages(sessionId, messages)

        verify(repository).deleteBySessionId(sessionId)
        verify(repository).saveAll(captor.capture())

        val saved = captor.lastValue
        assertEquals(2, saved.size)
        assertEquals(MessageRole.USER, saved[0].role)
        assertEquals("Hello", saved[0].content)
        assertEquals(MessageRole.AI, saved[1].role)
        assertEquals("Hi!", saved[1].content)
    }

    @Test
    fun `should store user message`() {
        val messages = listOf(UserMessage.from("Test message"))
        val captor = argumentCaptor<List<AssistantMessageEntity>>()

        store.updateMessages(sessionId, messages)

        verify(repository).saveAll(captor.capture())
        val saved = captor.lastValue.first()
        assertEquals(MessageRole.USER, saved.role)
        assertEquals("Test message", saved.content)
    }

    @Test
    fun `should store AI message`() {
        val messages = listOf(AiMessage.from("AI response"))
        val captor = argumentCaptor<List<AssistantMessageEntity>>()

        store.updateMessages(sessionId, messages)

        verify(repository).saveAll(captor.capture())
        val saved = captor.lastValue.first()
        assertEquals(MessageRole.AI, saved.role)
        assertEquals("AI response", saved.content)
    }

    @Test
    fun `should store system message`() {
        val messages = listOf(SystemMessage.from("System prompt"))
        val captor = argumentCaptor<List<AssistantMessageEntity>>()

        store.updateMessages(sessionId, messages)

        verify(repository).saveAll(captor.capture())
        val saved = captor.lastValue.first()
        assertEquals(MessageRole.SYSTEM, saved.role)
        assertEquals("System prompt", saved.content)
    }

    @Test
    fun `should store tool execution result message`() {
        val messages = listOf(
            ToolExecutionResultMessage.from("exec-123", "getCurrentTime", "10:00 AM")
        )
        val captor = argumentCaptor<List<AssistantMessageEntity>>()

        store.updateMessages(sessionId, messages)

        verify(repository).saveAll(captor.capture())
        val saved = captor.lastValue.first()
        assertEquals(MessageRole.TOOL_EXECUTION_RESULT, saved.role)
        assertEquals("10:00 AM", saved.content)
        assertEquals("getCurrentTime", saved.toolCalls)
        assertEquals("exec-123", saved.toolExecutionId)
    }

    @Test
    fun `should retrieve tool execution result message`() {
        val entity = AssistantMessageEntity(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            role = MessageRole.TOOL_EXECUTION_RESULT,
            content = "10:00 AM",
            toolCalls = "getCurrentTime",
            toolExecutionId = "exec-123",
            createdAt = Instant.now()
        )
        whenever(repository.findBySessionIdOrderByCreatedAtAsc(sessionId)).thenReturn(listOf(entity))

        val result = store.getMessages(sessionId)

        assertEquals(1, result.size)
        val message = result.first()
        assertIs<ToolExecutionResultMessage>(message)
        assertEquals("10:00 AM", message.text())
        assertEquals("getCurrentTime", message.toolName())
        assertEquals("exec-123", message.id())
    }

    @Test
    fun `should delete messages`() {
        store.deleteMessages(sessionId)

        verify(repository).deleteBySessionId(sessionId)
    }

    @Test
    fun `should delete messages with string memoryId`() {
        store.deleteMessages(sessionId.toString())

        verify(repository).deleteBySessionId(sessionId)
    }

    private fun createMessageEntity(
        role: MessageRole,
        content: String,
        toolCalls: String? = null,
        toolExecutionId: String? = null
    ) = AssistantMessageEntity(
        id = UUID.randomUUID(),
        sessionId = sessionId,
        role = role,
        content = content,
        toolCalls = toolCalls,
        toolExecutionId = toolExecutionId,
        createdAt = Instant.now()
    )
}
