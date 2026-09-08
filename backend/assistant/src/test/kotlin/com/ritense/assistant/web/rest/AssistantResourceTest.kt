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

package com.ritense.assistant.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.domain.AssistantSessionEntity
import com.ritense.assistant.service.ActionResult
import com.ritense.assistant.service.AssistantService
import com.ritense.assistant.service.AssistantSessionService
import com.ritense.assistant.service.PendingActionService
import com.ritense.assistant.web.rest.dto.AssistantResponse
import com.ritense.assistant.web.rest.dto.ChatRequest
import com.ritense.assistant.web.rest.dto.UpdateSessionTitleRequest
import com.ritense.valtimo.contract.authentication.ManageableUser
import com.ritense.valtimo.contract.authentication.UserManagementService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.data.web.PageableHandlerMethodArgumentResolver
import java.time.Instant
import java.util.UUID

class AssistantResourceTest {

    private lateinit var mockMvc: MockMvc
    private lateinit var assistantService: AssistantService
    private lateinit var sessionService: AssistantSessionService
    private lateinit var pendingActionService: PendingActionService
    private lateinit var userManagementService: UserManagementService
    private lateinit var objectMapper: ObjectMapper

    private val userId = "user123"

    @BeforeEach
    fun setUp() {
        assistantService = mock()
        sessionService = mock()
        pendingActionService = mock()
        userManagementService = mock()
        objectMapper = ObjectMapper().findAndRegisterModules()

        val resource = AssistantResource(
            assistantService,
            sessionService,
            pendingActionService,
            userManagementService
        )

        mockMvc = MockMvcBuilders.standaloneSetup(resource)
            .setCustomArgumentResolvers(PageableHandlerMethodArgumentResolver())
            .build()

        val mockUser = mock<ManageableUser>()
        whenever(mockUser.id).thenReturn(userId)
        whenever(mockUser.email).thenReturn("user@test.com")
        whenever(mockUser.roles).thenReturn(listOf("ROLE_USER"))
        whenever(userManagementService.currentUser).thenReturn(mockUser)
    }

    @Test
    fun `GET config should return enabled status`() {
        whenever(assistantService.isConfigured()).thenReturn(true)

        mockMvc.perform(get("/api/v1/assistant/config"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.enabled").value(true))
            .andExpect(jsonPath("$.configured").value(true))
    }

    @Test
    fun `GET config should return configured false when not configured`() {
        whenever(assistantService.isConfigured()).thenReturn(false)

        mockMvc.perform(get("/api/v1/assistant/config"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.configured").value(false))
    }

    @Test
    fun `POST chat should return assistant response`() {
        val sessionId = UUID.randomUUID()
        val response = AssistantResponse(
            message = "Hello! How can I help?",
            sessionId = sessionId.toString()
        )
        whenever(assistantService.chat(any(), any(), any(), any(), any())).thenReturn(response)

        val request = ChatRequest(message = "Hello")

        mockMvc.perform(
            post("/api/v1/assistant/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value("Hello! How can I help?"))
            .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
    }

    @Test
    fun `POST chat with sessionId should use existing session`() {
        val sessionId = UUID.randomUUID()
        val response = AssistantResponse(
            message = "Continuing conversation",
            sessionId = sessionId.toString()
        )
        whenever(assistantService.chat(any(), any(), any(), any(), any())).thenReturn(response)

        val request = ChatRequest(message = "Continue", sessionId = sessionId)

        mockMvc.perform(
            post("/api/v1/assistant/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.sessionId").value(sessionId.toString()))
    }

    @Test
    fun `GET sessions should return paginated list`() {
        val sessions = listOf(
            createSession(UUID.randomUUID(), "Chat 1"),
            createSession(UUID.randomUUID(), "Chat 2")
        )
        val page = PageImpl(sessions, PageRequest.of(0, 20), 2)
        whenever(sessionService.getSessions(eq(userId), any())).thenReturn(page)

        mockMvc.perform(get("/api/v1/assistant/sessions"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content").isArray)
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.content[0].title").value("Chat 1"))
    }

    @Test
    fun `GET session by id should return session`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, "My Chat")
        whenever(sessionService.getSession(sessionId, userId)).thenReturn(session)

        mockMvc.perform(get("/api/v1/assistant/sessions/$sessionId"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(sessionId.toString()))
            .andExpect(jsonPath("$.title").value("My Chat"))
    }

    @Test
    fun `GET session by id should return 404 when not found`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionService.getSession(sessionId, userId)).thenReturn(null)

        mockMvc.perform(get("/api/v1/assistant/sessions/$sessionId"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `PUT session should update title`() {
        val sessionId = UUID.randomUUID()
        val session = createSession(sessionId, "Updated Title")
        whenever(sessionService.updateSessionTitle(sessionId, userId, "Updated Title")).thenReturn(session)

        val request = UpdateSessionTitleRequest(title = "Updated Title")

        mockMvc.perform(
            put("/api/v1/assistant/sessions/$sessionId")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.title").value("Updated Title"))
    }

    @Test
    fun `PUT session should return 404 when not found`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionService.updateSessionTitle(sessionId, userId, "New Title")).thenReturn(null)

        val request = UpdateSessionTitleRequest(title = "New Title")

        mockMvc.perform(
            put("/api/v1/assistant/sessions/$sessionId")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request))
        )
            .andExpect(status().isNotFound)
    }

    @Test
    fun `DELETE session should return 204`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionService.deleteSession(sessionId, userId)).thenReturn(true)

        mockMvc.perform(delete("/api/v1/assistant/sessions/$sessionId"))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `DELETE session should return 404 when not found`() {
        val sessionId = UUID.randomUUID()
        whenever(sessionService.deleteSession(sessionId, userId)).thenReturn(false)

        mockMvc.perform(delete("/api/v1/assistant/sessions/$sessionId"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `POST confirm should return success`() {
        val actionId = UUID.randomUUID()
        val result = mapOf("success" to true, "message" to "Applied")
        whenever(pendingActionService.confirmAction(actionId, userId))
            .thenReturn(ActionResult.Success(result))

        mockMvc.perform(post("/api/v1/assistant/confirm/$actionId"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
    }

    @Test
    fun `POST confirm should return 404 when not found`() {
        val actionId = UUID.randomUUID()
        whenever(pendingActionService.confirmAction(actionId, userId))
            .thenReturn(ActionResult.NotFound)

        mockMvc.perform(post("/api/v1/assistant/confirm/$actionId"))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `POST confirm should return 400 when expired`() {
        val actionId = UUID.randomUUID()
        whenever(pendingActionService.confirmAction(actionId, userId))
            .thenReturn(ActionResult.Expired)

        mockMvc.perform(post("/api/v1/assistant/confirm/$actionId"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error").value("Action has expired"))
    }

    @Test
    fun `POST confirm should return 400 with error message`() {
        val actionId = UUID.randomUUID()
        whenever(pendingActionService.confirmAction(actionId, userId))
            .thenReturn(ActionResult.Error("Something went wrong"))

        mockMvc.perform(post("/api/v1/assistant/confirm/$actionId"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error").value("Something went wrong"))
    }

    @Test
    fun `POST cancel should return 204`() {
        val actionId = UUID.randomUUID()
        whenever(pendingActionService.cancelAction(actionId, userId)).thenReturn(true)

        mockMvc.perform(post("/api/v1/assistant/cancel/$actionId"))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `POST cancel should return 404 when not found`() {
        val actionId = UUID.randomUUID()
        whenever(pendingActionService.cancelAction(actionId, userId)).thenReturn(false)

        mockMvc.perform(post("/api/v1/assistant/cancel/$actionId"))
            .andExpect(status().isNotFound)
    }

    private fun createSession(id: UUID, title: String?): AssistantSessionEntity {
        val now = Instant.now()
        return AssistantSessionEntity(
            id = id,
            userId = userId,
            title = title,
            createdAt = now,
            lastActivityAt = now
        )
    }
}
