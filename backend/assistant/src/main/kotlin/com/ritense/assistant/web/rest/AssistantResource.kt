
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

import com.ritense.assistant.service.ActionResult
import com.ritense.assistant.service.AssistantService
import com.ritense.assistant.service.AssistantSessionService
import com.ritense.assistant.service.PendingActionService
import com.ritense.assistant.web.rest.dto.AssistantConfigResponse
import com.ritense.assistant.web.rest.dto.ChatRequest
import com.ritense.assistant.web.rest.dto.ConfirmActionResponse
import com.ritense.assistant.web.rest.dto.SessionResponse
import com.ritense.assistant.web.rest.dto.UpdateSessionTitleRequest
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.domain.ValtimoMediaType
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE])
class AssistantResource(
    private val assistantService: AssistantService,
    private val sessionService: AssistantSessionService,
    private val pendingActionService: PendingActionService,
    private val userManagementService: UserManagementService
) {

    @GetMapping("/v1/assistant/config")
    fun getConfig(): ResponseEntity<AssistantConfigResponse> {
        return ResponseEntity.ok(
            AssistantConfigResponse(
                enabled = true,
                configured = assistantService.isConfigured()
            )
        )
    }

    @PostMapping("/v1/assistant/chat")
    fun chat(
        @Valid @RequestBody request: ChatRequest,
        httpRequest: HttpServletRequest
    ): ResponseEntity<*> {
        val currentUser = userManagementService.currentUser
        val authToken = extractAuthToken(httpRequest)

        val response = assistantService.chat(
            request = request,
            userId = currentUser.id,
            userEmail = currentUser.email,
            userRoles = currentUser.roles.toSet(),
            authToken = authToken
        )

        return ResponseEntity.ok(response)
    }

    @GetMapping("/v1/assistant/sessions")
    fun getSessions(
        @PageableDefault(size = 20, sort = ["lastActivityAt"], direction = Sort.Direction.DESC)
        pageable: Pageable
    ): ResponseEntity<Page<SessionResponse>> {
        val currentUser = userManagementService.currentUser
        val sessions = sessionService.getSessions(currentUser.id, pageable)
            .map { SessionResponse.from(it) }
        return ResponseEntity.ok(sessions)
    }

    @GetMapping("/v1/assistant/sessions/{sessionId}")
    fun getSession(@PathVariable sessionId: UUID): ResponseEntity<SessionResponse> {
        val currentUser = userManagementService.currentUser
        val session = sessionService.getSession(sessionId, currentUser.id)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(SessionResponse.from(session))
    }

    @PutMapping("/v1/assistant/sessions/{sessionId}")
    fun updateSessionTitle(
        @PathVariable sessionId: UUID,
        @Valid @RequestBody request: UpdateSessionTitleRequest
    ): ResponseEntity<SessionResponse> {
        val currentUser = userManagementService.currentUser
        val session = sessionService.updateSessionTitle(sessionId, currentUser.id, request.title)
            ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(SessionResponse.from(session))
    }

    @DeleteMapping("/v1/assistant/sessions/{sessionId}")
    fun deleteSession(@PathVariable sessionId: UUID): ResponseEntity<Void> {
        val currentUser = userManagementService.currentUser
        val deleted = sessionService.deleteSession(sessionId, currentUser.id)
        return if (deleted) {
            ResponseEntity.noContent().build()
        } else {
            ResponseEntity.notFound().build()
        }
    }

    @PostMapping("/v1/assistant/confirm/{pendingActionId}")
    fun confirmAction(@PathVariable pendingActionId: UUID): ResponseEntity<ConfirmActionResponse> {
        val currentUser = userManagementService.currentUser

        return when (val result = pendingActionService.confirmAction(pendingActionId, currentUser.id)) {
            is ActionResult.Success -> ResponseEntity.ok(
                ConfirmActionResponse(success = true, result = result.result)
            )
            is ActionResult.NotFound -> ResponseEntity.notFound().build()
            is ActionResult.Expired -> ResponseEntity.badRequest().body(
                ConfirmActionResponse(success = false, error = "Action has expired")
            )
            is ActionResult.Error -> ResponseEntity.badRequest().body(
                ConfirmActionResponse(success = false, error = result.message)
            )
        }
    }

    @PostMapping("/v1/assistant/cancel/{pendingActionId}")
    fun cancelAction(@PathVariable pendingActionId: UUID): ResponseEntity<Void> {
        val currentUser = userManagementService.currentUser
        val cancelled = pendingActionService.cancelAction(pendingActionId, currentUser.id)
        return if (cancelled) {
            ResponseEntity.noContent().build()
        } else {
            ResponseEntity.notFound().build()
        }
    }

    private fun extractAuthToken(request: HttpServletRequest): String {
        val authHeader = request.getHeader("Authorization")
        return if (authHeader?.startsWith("Bearer ") == true) {
            authHeader.substring(7)
        } else {
            ""
        }
    }
}
