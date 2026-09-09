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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.domain.PendingAssistantAction
import com.ritense.assistant.tool.ToolContext
import com.ritense.assistant.tool.ToolContextHolder
import com.ritense.assistant.web.rest.dto.AssistantAction
import com.ritense.assistant.web.rest.dto.AssistantResponse
import com.ritense.assistant.web.rest.dto.ChangePreview
import com.ritense.assistant.web.rest.dto.ChatRequest
import com.ritense.assistant.web.rest.dto.DiffContent
import dev.langchain4j.agent.tool.ToolExecutionRequest
import dev.langchain4j.agent.tool.ToolSpecification
import dev.langchain4j.agent.tool.ToolSpecifications
import dev.langchain4j.data.message.AiMessage
import dev.langchain4j.data.message.SystemMessage
import dev.langchain4j.data.message.ToolExecutionResultMessage
import dev.langchain4j.data.message.UserMessage
import dev.langchain4j.memory.chat.ChatMemoryProvider
import dev.langchain4j.model.chat.ChatModel
import dev.langchain4j.model.chat.request.ChatRequest as LangChainChatRequest
import dev.langchain4j.model.chat.request.ChatRequestParameters
import dev.langchain4j.service.tool.DefaultToolExecutor
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID

open class AssistantService(
    private val chatModel: ChatModel?,
    private val chatMemoryProvider: ChatMemoryProvider,
    private val contextBuilder: AssistantContextBuilder,
    private val sessionService: AssistantSessionService,
    private val pendingActionService: PendingActionService,
    private val objectMapper: ObjectMapper,
    private val toolProviders: List<Any>
) {
    private val logger = KotlinLogging.logger {}

    private val toolSpecifications: List<ToolSpecification>
    private val toolExecutors: Map<String, Pair<Any, java.lang.reflect.Method>>

    init {
        val specs = mutableListOf<ToolSpecification>()
        val executors = mutableMapOf<String, Pair<Any, java.lang.reflect.Method>>()

        toolProviders.forEach { provider ->
            val providerSpecs = ToolSpecifications.toolSpecificationsFrom(provider)
            specs.addAll(providerSpecs)

            provider.javaClass.methods
                .filter { it.isAnnotationPresent(dev.langchain4j.agent.tool.Tool::class.java) }
                .forEach { method ->
                    val toolName = method.name
                    executors[toolName] = provider to method
                }
        }

        toolSpecifications = specs
        toolExecutors = executors

        logger.info { "Registered ${toolSpecifications.size} assistant tools: ${toolSpecifications.map { it.name() }}" }
    }

    open fun chat(
        request: ChatRequest,
        userId: String,
        userEmail: String,
        userRoles: Set<String>,
        authToken: String
    ): AssistantResponse {
        if (chatModel == null) {
            logger.warn { "Assistant chat requested but no ChatLanguageModel is configured" }
            return AssistantResponse(
                message = "The assistant is not configured. Please contact your administrator.",
                sessionId = request.sessionId?.toString() ?: UUID.randomUUID().toString()
            )
        }

        val sessionId = request.sessionId ?: run {
            val session = sessionService.createSession(userId)
            session.id
        }

        sessionService.updateSessionActivity(sessionId)

        val memory = chatMemoryProvider.get(sessionId)

        if (memory.messages().isEmpty()) {
            val systemPrompt = contextBuilder.buildSystemPrompt(userEmail, userRoles, request.context, toolSpecifications)
            memory.add(SystemMessage.from(systemPrompt))
        }

        memory.add(UserMessage.from(request.message))

        val toolContext = ToolContext(
            userId = userId,
            userEmail = userEmail,
            userRoles = userRoles,
            authToken = authToken,
            sessionId = sessionId,
            pageContext = request.context
        )

        return ToolContextHolder.withContext(toolContext) {
            executeWithToolLoop(memory, sessionId, userId)
        }
    }

    private fun executeWithToolLoop(
        memory: dev.langchain4j.memory.ChatMemory,
        sessionId: UUID,
        userId: String
    ): AssistantResponse {
        val maxIterations = 10
        var iteration = 0

        while (iteration < maxIterations) {
            iteration++

            val chatRequestParams = if (toolSpecifications.isNotEmpty()) {
                ChatRequestParameters.builder()
                    .toolSpecifications(toolSpecifications)
                    .build()
            } else {
                ChatRequestParameters.builder().build()
            }

            val chatRequest = LangChainChatRequest.builder()
                .messages(memory.messages())
                .parameters(chatRequestParams)
                .build()

            val response = try {
                chatModel!!.chat(chatRequest)
            } catch (e: Exception) {
                logger.error(e) { "Error generating response from chat model" }
                return AssistantResponse(
                    message = "I encountered an error processing your request. Please try again.",
                    sessionId = sessionId.toString()
                )
            }

            val aiMessage = response.aiMessage()
            memory.add(aiMessage)

            if (!aiMessage.hasToolExecutionRequests()) {
                val pendingAction = pendingActionService.findLatestBySessionIdAndUserId(sessionId, userId)
                val action = pendingAction?.let { buildConfirmationAction(it) }

                return AssistantResponse(
                    message = aiMessage.text() ?: "",
                    sessionId = sessionId.toString(),
                    action = action
                )
            }

            val toolRequests = aiMessage.toolExecutionRequests()
            for (toolRequest in toolRequests) {
                val result = executeTool(toolRequest)
                memory.add(ToolExecutionResultMessage.from(toolRequest, result))
            }
        }

        logger.warn { "Max tool execution iterations reached for session $sessionId" }
        return AssistantResponse(
            message = "I'm having trouble completing your request. Please try simplifying your question.",
            sessionId = sessionId.toString()
        )
    }

    private fun buildConfirmationAction(pending: PendingAssistantAction): AssistantAction.ConfirmationRequired? {
        if (pending.previewDescription == null) return null

        return AssistantAction.ConfirmationRequired(
            preview = ChangePreview(
                description = pending.previewDescription,
                diff = if (pending.diffBefore != null && pending.diffAfter != null) {
                    DiffContent(pending.diffBefore, pending.diffAfter)
                } else null,
                affectedResources = pending.affectedResources?.let {
                    objectMapper.readValue(it, object : TypeReference<List<String>>() {})
                }
            ),
            pendingActionId = pending.id.toString()
        )
    }

    private fun executeTool(request: ToolExecutionRequest): String {
        val toolName = request.name()
        val (provider, method) = toolExecutors[toolName]
            ?: return "Error: Unknown tool '$toolName'"

        return try {
            val executor = DefaultToolExecutor(provider, method)
            executor.execute(request, null)
        } catch (e: Exception) {
            logger.error(e) { "Error executing tool '$toolName'" }
            "Error executing tool: ${e.message}"
        }
    }

    open fun isConfigured(): Boolean = chatModel != null
}
