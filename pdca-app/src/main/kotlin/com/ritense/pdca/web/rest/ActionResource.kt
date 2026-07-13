/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.pdca.web.rest

import com.ritense.pdca.domain.Action
import com.ritense.pdca.service.ActionService
import com.ritense.pdca.service.GoalService
import com.ritense.pdca.web.rest.dto.ActionResponse
import com.ritense.pdca.web.rest.dto.CreateActionRequest
import com.ritense.pdca.web.rest.dto.UpdateActionRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@CrossOrigin
@RequestMapping("/api/v1", produces = [MediaType.APPLICATION_JSON_VALUE])
class ActionResource(
    private val actionService: ActionService,
    private val goalService: GoalService
) {

    @PostMapping("/goals/{goalId}/actions")
    fun createAction(
        @PathVariable(name = "goalId") goalId: UUID,
        @Valid @RequestBody request: CreateActionRequest
    ): ResponseEntity<ActionResponse> {
        val action = actionService.create(
            Action(
                goalId = goalId,
                title = request.title,
                description = request.description,
                assigneeType = request.assigneeType,
                assigneeName = request.assigneeName,
                priority = request.priority,
                startDate = request.startDate,
                dueDate = request.dueDate
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(ActionResponse(action))
    }

    @GetMapping("/plans/{planId}/actions")
    fun findByPlanId(
        @PathVariable(name = "planId") planId: UUID
    ): ResponseEntity<List<ActionResponse>> {
        val goals = goalService.findByPlanId(planId)
        val goalIds = goals.map { it.id }
        val actions = if (goalIds.isEmpty()) emptyList() else actionService.findByGoalIds(goalIds)
        return ResponseEntity.ok(actions.map { ActionResponse(it) })
    }

    @GetMapping("/goals/{goalId}/actions")
    fun findByGoalId(
        @PathVariable(name = "goalId") goalId: UUID
    ): ResponseEntity<List<ActionResponse>> {
        val actions = actionService.findByGoalId(goalId)
        return ResponseEntity.ok(actions.map { ActionResponse(it) })
    }

    @GetMapping("/actions/{id}")
    fun getAction(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<ActionResponse> {
        val action = actionService.getById(id)
        return ResponseEntity.ok(ActionResponse(action))
    }

    @PatchMapping("/actions/{id}")
    fun updateAction(
        @PathVariable(name = "id") id: UUID,
        @Valid @RequestBody request: UpdateActionRequest
    ): ResponseEntity<ActionResponse> {
        val existing = actionService.getById(id)
        val updated = existing.copy(
            title = request.title ?: existing.title,
            description = request.description ?: existing.description,
            status = request.status ?: existing.status,
            assigneeType = request.assigneeType ?: existing.assigneeType,
            assigneeName = request.assigneeName ?: existing.assigneeName,
            priority = request.priority ?: existing.priority,
            startDate = request.startDate ?: existing.startDate,
            dueDate = request.dueDate ?: existing.dueDate,
            completedDate = request.completedDate ?: existing.completedDate,
            result = request.result ?: existing.result
        )
        val action = actionService.update(id, updated)
        return ResponseEntity.ok(ActionResponse(action))
    }

    @PostMapping("/actions/{id}/submit-for-review")
    fun submitForReview(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<ActionResponse> {
        val action = actionService.submitForReview(id)
        return ResponseEntity.ok(ActionResponse(action))
    }

    @PostMapping("/actions/{id}/approve")
    fun approve(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<ActionResponse> {
        val action = actionService.approve(id)
        return ResponseEntity.ok(ActionResponse(action))
    }

    @PostMapping("/actions/{id}/reject")
    fun reject(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<ActionResponse> {
        val action = actionService.reject(id)
        return ResponseEntity.ok(ActionResponse(action))
    }
}
