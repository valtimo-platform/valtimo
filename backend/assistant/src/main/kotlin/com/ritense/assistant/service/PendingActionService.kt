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
import dev.langchain4j.data.message.UserMessage
import dev.langchain4j.memory.chat.ChatMemoryProvider
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

open class PendingActionService(
    private val repository: PendingAssistantActionRepository,
    private val actionExecutors: Map<String, ActionExecutor>,
    private val chatMemoryProvider: ChatMemoryProvider
) {
    private val logger = KotlinLogging.logger {}

    init {
        logger.info { "Registered assistant action executors: ${actionExecutors.keys}" }
    }

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

    // Not transactional: executors run their own transactions, and a failing one would otherwise mark this
    // transaction rollback-only, turning the caught error into an UnexpectedRollbackException on commit.
    open fun confirmAction(actionId: UUID, userId: String): ActionResult {
        val action = repository.findByIdAndUserId(actionId, userId)
            ?: return ActionResult.NotFound

        if (action.isExpired()) {
            repository.delete(action)
            return ActionResult.Expired
        }

        val executor = actionExecutors[action.tool]
            ?: run {
                logger.error { "No executor registered for assistant action '${action.tool}' (${action.id})" }
                return ActionResult.Error("Unknown action type: ${action.tool}")
            }

        return try {
            val result = executor.execute(action.params, userId)
            repository.delete(action)
            recordInMemory(
                action,
                "[Note: the user confirmed \"${describe(action)}\" and it has been applied. " +
                    "Anything you read before this about the affected item is outdated; fetch it again before changing it.]"
            )
            ActionResult.Success(result)
        } catch (e: Exception) {
            logger.error(e) { "Error executing assistant action '${action.tool}' (${action.id})" }
            val message = e.message ?: "Unknown error executing action"
            recordInMemory(action, "[Note: applying \"${describe(action)}\" failed: $message. Nothing was changed.]")
            ActionResult.Error(message)
        }
    }

    open fun cancelAction(actionId: UUID, userId: String): Boolean {
        val action = repository.findByIdAndUserId(actionId, userId) ?: return false
        repository.delete(action)
        recordInMemory(action, "[Note: the user cancelled \"${describe(action)}\". Nothing was changed.]")
        return true
    }

    private fun describe(action: PendingAssistantAction): String = action.previewDescription ?: action.tool

    private fun recordInMemory(action: PendingAssistantAction, note: String) {
        try {
            chatMemoryProvider.get(action.sessionId).add(UserMessage.from(note))
        } catch (e: Exception) {
            logger.warn(e) { "Could not record the outcome of assistant action ${action.id} in chat memory" }
        }
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
