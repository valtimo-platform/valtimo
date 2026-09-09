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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.domain.AssistantSessionEntity
import com.ritense.assistant.web.rest.dto.ChatRequest
import dev.langchain4j.agent.tool.Tool
import dev.langchain4j.agent.tool.ToolExecutionRequest
import dev.langchain4j.data.message.AiMessage
import dev.langchain4j.memory.chat.ChatMemoryProvider
import dev.langchain4j.memory.chat.MessageWindowChatMemory
import dev.langchain4j.model.chat.ChatModel
import dev.langchain4j.model.chat.request.ChatRequest as LangChainChatRequest
import dev.langchain4j.model.chat.response.ChatResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AssistantServiceTest {

    private lateinit var chatModel: ChatModel
    private lateinit var chatMemoryProvider: ChatMemoryProvider
    private lateinit var contextBuilder: AssistantContextBuilder
    private lateinit var sessionService: AssistantSessionService
    private lateinit var pendingActionService: PendingActionService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var assistantService: AssistantService

    @BeforeEach
    fun setUp() {
        chatModel = mock()
        chatMemoryProvider = mock()
        contextBuilder = AssistantContextBuilder()
        sessionService = mock()
        pendingActionService = mock()
        objectMapper = ObjectMapper()

        assistantService = AssistantService(
            chatModel,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            emptyList()
        )
    }

    @Test
    fun `should return error message when chat model is null`() {
        val serviceWithoutModel = AssistantService(
            null,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            emptyList()
        )

        val result = serviceWithoutModel.chat(
            request = ChatRequest(message = "Hello"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        assertEquals("The assistant is not configured. Please contact your administrator.", result.message)
    }

    @Test
    fun `should create new session when sessionId is null`() {
        val sessionId = UUID.randomUUID()
        val session = AssistantSessionEntity(
            id = sessionId,
            userId = "user123",
            title = null,
            createdAt = Instant.now(),
            lastActivityAt = Instant.now()
        )
        val memory = MessageWindowChatMemory.withMaxMessages(10)

        whenever(sessionService.createSession("user123")).thenReturn(session)
        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)

        val aiMessage = AiMessage.from("Hello! How can I help?")
        val chatResponse = ChatResponse.builder().aiMessage(aiMessage).build()
        whenever(chatModel.chat(any<LangChainChatRequest>())).thenReturn(chatResponse)

        val result = assistantService.chat(
            request = ChatRequest(message = "Hello"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        verify(sessionService).createSession("user123")
        assertEquals(sessionId.toString(), result.sessionId)
        assertEquals("Hello! How can I help?", result.message)
    }

    @Test
    fun `isConfigured should return true when chat model is present`() {
        assertEquals(true, assistantService.isConfigured())
    }

    @Test
    fun `isConfigured should return false when chat model is null`() {
        val serviceWithoutModel = AssistantService(
            null,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            emptyList()
        )
        assertEquals(false, serviceWithoutModel.isConfigured())
    }

    @Test
    fun `should use existing session when sessionId is provided`() {
        val sessionId = UUID.randomUUID()
        val memory = MessageWindowChatMemory.withMaxMessages(10)

        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)

        val aiMessage = AiMessage.from("Response")
        val chatResponse = ChatResponse.builder().aiMessage(aiMessage).build()
        whenever(chatModel.chat(any<LangChainChatRequest>())).thenReturn(chatResponse)

        val result = assistantService.chat(
            request = ChatRequest(message = "Hello", sessionId = sessionId),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        verify(sessionService, never()).createSession(any<String>(), any())
        verify(sessionService).updateSessionActivity(eq(sessionId))
        assertEquals(sessionId.toString(), result.sessionId)
    }

    @Test
    fun `should execute tool when AI requests it`() {
        val sessionId = UUID.randomUUID()
        val session = AssistantSessionEntity(
            id = sessionId,
            userId = "user123",
            title = null,
            createdAt = Instant.now(),
            lastActivityAt = Instant.now()
        )
        val memory = MessageWindowChatMemory.withMaxMessages(10)
        val toolProvider = TestToolProvider()

        val serviceWithTools = AssistantService(
            chatModel,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            listOf(toolProvider)
        )

        whenever(sessionService.createSession("user123")).thenReturn(session)
        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)

        val toolRequest = ToolExecutionRequest.builder()
            .name("getCurrentTime")
            .arguments("{}")
            .id("call-1")
            .build()
        val aiMessageWithTool = AiMessage.from(listOf(toolRequest))
        val toolResponse = ChatResponse.builder().aiMessage(aiMessageWithTool).build()

        val finalAiMessage = AiMessage.from("The current time is 10:00")
        val finalResponse = ChatResponse.builder().aiMessage(finalAiMessage).build()

        whenever(chatModel.chat(any<LangChainChatRequest>()))
            .thenReturn(toolResponse)
            .thenReturn(finalResponse)

        val result = serviceWithTools.chat(
            request = ChatRequest(message = "What time is it?"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        assertEquals("The current time is 10:00", result.message)
        verify(chatModel, times(2)).chat(any<LangChainChatRequest>())
    }

    @Test
    fun `should handle unknown tool gracefully`() {
        val sessionId = UUID.randomUUID()
        val session = AssistantSessionEntity(
            id = sessionId,
            userId = "user123",
            title = null,
            createdAt = Instant.now(),
            lastActivityAt = Instant.now()
        )
        val memory = MessageWindowChatMemory.withMaxMessages(10)

        whenever(sessionService.createSession("user123")).thenReturn(session)
        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)

        val toolRequest = ToolExecutionRequest.builder()
            .name("unknownTool")
            .arguments("{}")
            .id("call-1")
            .build()
        val aiMessageWithTool = AiMessage.from(listOf(toolRequest))
        val toolResponse = ChatResponse.builder().aiMessage(aiMessageWithTool).build()

        val finalAiMessage = AiMessage.from("I couldn't execute that tool")
        val finalResponse = ChatResponse.builder().aiMessage(finalAiMessage).build()

        whenever(chatModel.chat(any<LangChainChatRequest>()))
            .thenReturn(toolResponse)
            .thenReturn(finalResponse)

        val result = assistantService.chat(
            request = ChatRequest(message = "Do something"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        assertEquals("I couldn't execute that tool", result.message)
    }

    @Test
    fun `should return error when chat model throws exception`() {
        val sessionId = UUID.randomUUID()
        val session = AssistantSessionEntity(
            id = sessionId,
            userId = "user123",
            title = null,
            createdAt = Instant.now(),
            lastActivityAt = Instant.now()
        )
        val memory = MessageWindowChatMemory.withMaxMessages(10)

        whenever(sessionService.createSession("user123")).thenReturn(session)
        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)
        whenever(chatModel.chat(any<LangChainChatRequest>())).thenThrow(RuntimeException("API error"))

        val result = assistantService.chat(
            request = ChatRequest(message = "Hello"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        assertEquals("I encountered an error processing your request. Please try again.", result.message)
    }

    @Test
    fun `should stop at max iterations`() {
        val sessionId = UUID.randomUUID()
        val session = AssistantSessionEntity(
            id = sessionId,
            userId = "user123",
            title = null,
            createdAt = Instant.now(),
            lastActivityAt = Instant.now()
        )
        val memory = MessageWindowChatMemory.withMaxMessages(50)
        val toolProvider = TestToolProvider()

        val serviceWithTools = AssistantService(
            chatModel,
            chatMemoryProvider,
            contextBuilder,
            sessionService,
            pendingActionService,
            objectMapper,
            listOf(toolProvider)
        )

        whenever(sessionService.createSession("user123")).thenReturn(session)
        whenever(chatMemoryProvider.get(sessionId)).thenReturn(memory)

        val toolRequest = ToolExecutionRequest.builder()
            .name("getCurrentTime")
            .arguments("{}")
            .id("call-1")
            .build()
        val aiMessageWithTool = AiMessage.from(listOf(toolRequest))
        val toolResponse = ChatResponse.builder().aiMessage(aiMessageWithTool).build()

        whenever(chatModel.chat(any<LangChainChatRequest>())).thenReturn(toolResponse)

        val result = serviceWithTools.chat(
            request = ChatRequest(message = "Loop forever"),
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token"
        )

        assertTrue(result.message.contains("trouble completing your request"))
        verify(chatModel, times(10)).chat(any<LangChainChatRequest>())
    }

    class TestToolProvider {
        @Tool("Get the current time")
        fun getCurrentTime(): String = "10:00 AM"
    }
}
