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

import com.ritense.pdca.domain.Goal
import com.ritense.pdca.service.GoalService
import com.ritense.pdca.web.rest.dto.CreateGoalRequest
import com.ritense.pdca.web.rest.dto.GoalResponse
import com.ritense.pdca.web.rest.dto.UpdateGoalRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.DeleteMapping
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
class GoalResource(
    private val goalService: GoalService
) {

    @PostMapping("/plans/{planId}/goals")
    fun createGoal(
        @PathVariable(name = "planId") planId: UUID,
        @Valid @RequestBody request: CreateGoalRequest
    ): ResponseEntity<GoalResponse> {
        val goal = goalService.create(
            Goal(
                planId = planId,
                title = request.title,
                description = request.description,
                goalType = request.goalType,
                phase = request.phase,
                startDate = request.startDate,
                targetEndDate = request.targetEndDate,
                sortOrder = request.sortOrder
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(GoalResponse(goal))
    }

    @GetMapping("/plans/{planId}/goals")
    fun findByPlanId(
        @PathVariable(name = "planId") planId: UUID
    ): ResponseEntity<List<GoalResponse>> {
        val goals = goalService.findByPlanId(planId)
        return ResponseEntity.ok(goals.map { GoalResponse(it) })
    }

    @GetMapping("/goals/{id}")
    fun getGoal(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<GoalResponse> {
        val goal = goalService.getById(id)
        return ResponseEntity.ok(GoalResponse(goal))
    }

    @PatchMapping("/goals/{id}")
    fun updateGoal(
        @PathVariable(name = "id") id: UUID,
        @Valid @RequestBody request: UpdateGoalRequest
    ): ResponseEntity<GoalResponse> {
        val existing = goalService.getById(id)
        val updated = existing.copy(
            title = request.title ?: existing.title,
            description = request.description ?: existing.description,
            goalType = request.goalType ?: existing.goalType,
            status = request.status ?: existing.status,
            phase = request.phase ?: existing.phase,
            startDate = request.startDate ?: existing.startDate,
            targetEndDate = request.targetEndDate ?: existing.targetEndDate,
            progressScore = request.progressScore ?: existing.progressScore,
            progressExplanation = request.progressExplanation ?: existing.progressExplanation,
            sortOrder = request.sortOrder ?: existing.sortOrder
        )
        val goal = goalService.update(id, updated)
        return ResponseEntity.ok(GoalResponse(goal))
    }

    @DeleteMapping("/goals/{id}")
    fun deleteGoal(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<Unit> {
        goalService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
