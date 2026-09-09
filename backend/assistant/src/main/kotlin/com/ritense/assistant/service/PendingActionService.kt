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
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

open class PendingActionService(
    private val repository: PendingAssistantActionRepository,
    private val actionExecutors: Map<String, ActionExecutor>
) {
    companion object {
        val DEFAULT_TTL: Duration = Duration.ofMinutes(5)
    }

    @Transactional
    open fun createPendingAction(
        sessionId: UUID,
        userId: String,
        tool: String,
        params: String,
        resourceType: String? = null,
        resourceId: String? = null,
        previewDescription: String? = null,
        diffBefore: String? = null,
        diffAfter: String? = null,
        affectedResources: List<String>? = null,
        ttl: Duration = DEFAULT_TTL
    ): PendingAssistantAction {
        val now = Instant.now()
        val action = PendingAssistantAction(
            id = UUID.randomUUID(),
            sessionId = sessionId,
            userId = userId,
            tool = tool,
            params = params,
            resourceType = resourceType,
            resourceId = resourceId,
            previewDescription = previewDescription,
            diffBefore = diffBefore,
            diffAfter = diffAfter,
            affectedResources = affectedResources?.let {
                com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(it)
            },
            createdAt = now,
            expiresAt = now.plus(ttl)
        )
        return repository.save(action)
    }

    @Transactional(readOnly = true)
    open fun findLatestBySessionIdAndUserId(sessionId: UUID, userId: String): PendingAssistantAction? {
        return repository.findFirstBySessionIdAndUserIdOrderByCreatedAtDesc(sessionId, userId)
    }

    @Transactional(readOnly = true)
    open fun getPendingAction(actionId: UUID, userId: String): PendingAssistantAction? {
        return repository.findByIdAndUserId(actionId, userId)
    }

    @Transactional
    open fun confirmAction(actionId: UUID, userId: String): ActionResult {
        val action = repository.findByIdAndUserId(actionId, userId)
            ?: return ActionResult.NotFound

        if (action.isExpired()) {
            repository.delete(action)
            return ActionResult.Expired
        }

        val executor = actionExecutors[action.tool]
            ?: return ActionResult.Error("Unknown action type: ${action.tool}")

        return try {
            val result = executor.execute(action.params, userId)
            repository.delete(action)
            ActionResult.Success(result)
        } catch (e: Exception) {
            ActionResult.Error(e.message ?: "Unknown error executing action")
        }
    }

    @Transactional
    open fun cancelAction(actionId: UUID, userId: String): Boolean {
        val action = repository.findByIdAndUserId(actionId, userId) ?: return false
        repository.delete(action)
        return true
    }

    @Transactional
    open fun cleanupExpiredActions(): Int {
        return repository.deleteExpiredBefore(Instant.now())
    }
}

sealed class ActionResult {
    data class Success(val result: Any?) : ActionResult()
    data object NotFound : ActionResult()
    data object Expired : ActionResult()
    data class Error(val message: String) : ActionResult()
}

fun interface ActionExecutor {
    fun execute(params: String, userId: String): Any?
}
