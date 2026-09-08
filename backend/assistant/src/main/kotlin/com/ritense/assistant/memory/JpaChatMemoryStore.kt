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
import dev.langchain4j.data.message.ChatMessage
import dev.langchain4j.data.message.SystemMessage
import dev.langchain4j.data.message.ToolExecutionResultMessage
import dev.langchain4j.data.message.UserMessage
import dev.langchain4j.store.memory.chat.ChatMemoryStore
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

open class JpaChatMemoryStore(
    private val repository: AssistantMessageRepository
) : ChatMemoryStore {

    @Transactional(readOnly = true)
    override fun getMessages(memoryId: Any): List<ChatMessage> {
        val sessionId = parseSessionId(memoryId)
        return repository.findBySessionIdOrderByCreatedAtAsc(sessionId)
            .mapNotNull { it.toChatMessage() }
    }

    @Transactional
    override fun updateMessages(memoryId: Any, messages: List<ChatMessage>) {
        val sessionId = parseSessionId(memoryId)
        repository.deleteBySessionId(sessionId)

        val entities = messages.mapIndexed { index, message ->
            message.toEntity(sessionId, index)
        }
        repository.saveAll(entities)
    }

    @Transactional
    override fun deleteMessages(memoryId: Any) {
        val sessionId = parseSessionId(memoryId)
        repository.deleteBySessionId(sessionId)
    }

    private fun parseSessionId(memoryId: Any): UUID {
        return when (memoryId) {
            is UUID -> memoryId
            is String -> UUID.fromString(memoryId)
            else -> throw IllegalArgumentException("Memory ID must be UUID or String, got: ${memoryId::class}")
        }
    }

    private fun AssistantMessageEntity.toChatMessage(): ChatMessage? {
        return when (role) {
            MessageRole.USER -> UserMessage.from(content)
            MessageRole.AI -> AiMessage.from(content)
            MessageRole.SYSTEM -> SystemMessage.from(content)
            MessageRole.TOOL_EXECUTION_RESULT -> {
                toolExecutionId?.let { ToolExecutionResultMessage.from(it, toolCalls ?: "", content) }
            }
        }
    }

    private fun ChatMessage.toEntity(sessionId: UUID, index: Int): AssistantMessageEntity {
        val (role, content, toolCalls, toolExecutionId) = when (this) {
            is UserMessage -> MessageRole.USER to singleText() to null to null
            is AiMessage -> MessageRole.AI to text() to null to null
            is SystemMessage -> MessageRole.SYSTEM to text() to null to null
            is ToolExecutionResultMessage -> MessageRole.TOOL_EXECUTION_RESULT to text() to toolName() to id()
            else -> throw IllegalArgumentException("Unsupported message type: ${this::class}")
        }

        return AssistantMessageEntity(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            role = role,
            content = content ?: "",
            toolCalls = toolCalls,
            toolExecutionId = toolExecutionId,
            createdAt = Instant.now().plusMillis(index.toLong())
        )
    }

    private infix fun MessageRole.to(content: String?): Pair<MessageRole, String?> = Pair(this, content)
    private infix fun Pair<MessageRole, String?>.to(toolCalls: String?): Triple<MessageRole, String?, String?> =
        Triple(first, second, toolCalls)
    private infix fun Triple<MessageRole, String?, String?>.to(toolExecutionId: String?): Quadruple =
        Quadruple(first, second, third, toolExecutionId)

    private data class Quadruple(
        val role: MessageRole,
        val content: String?,
        val toolCalls: String?,
        val toolExecutionId: String?
    )
}
