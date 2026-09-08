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

package com.ritense.assistant.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "assistant_message")
class AssistantMessageEntity(
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    val id: UUID,

    @Column(name = "session_id", nullable = false)
    val sessionId: UUID,

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    val role: MessageRole,

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    val content: String,

    @Column(name = "tool_calls", columnDefinition = "TEXT")
    val toolCalls: String? = null,

    @Column(name = "tool_execution_id")
    val toolExecutionId: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AssistantMessageEntity) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}

enum class MessageRole {
    USER,
    AI,
    TOOL_EXECUTION_RESULT,
    SYSTEM
}
