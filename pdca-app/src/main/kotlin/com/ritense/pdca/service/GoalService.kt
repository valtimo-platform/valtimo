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

package com.ritense.pdca.service

import com.ritense.pdca.domain.Goal
import com.ritense.pdca.repository.GoalRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class GoalService(
    private val goalRepository: GoalRepository,
    private val planService: PlanService,
    private val phaseConfigService: PhaseConfigService
) {

    fun getById(id: UUID): Goal {
        return goalRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found with id: $id") }
    }

    fun findByPlanId(planId: UUID): List<Goal> {
        return goalRepository.findByPlanIdOrderBySortOrder(planId)
    }

    fun findByPlanIdAndPhase(planId: UUID, phase: String): List<Goal> {
        return goalRepository.findByPlanIdAndPhase(planId, phase)
    }

    fun create(goal: Goal): Goal {
        val plan = planService.getById(goal.planId)

        if (plan.caseDefinitionKey != null) {
            val validPhases = phaseConfigService.getPhases(plan.caseDefinitionKey!!)
            if (goal.phase !in validPhases) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid phase '${goal.phase}'. Valid phases: $validPhases"
                )
            }
        }

        val existingGoals = goalRepository.findByPlanIdOrderBySortOrder(goal.planId)
        val maxSortOrder = existingGoals.maxOfOrNull { it.sortOrder } ?: -1
        goal.sortOrder = maxSortOrder + 1

        return goalRepository.save(goal)
    }

    fun update(id: UUID, updated: Goal): Goal {
        val existing = getById(id)
        val plan = planService.getById(existing.planId)

        if (plan.caseDefinitionKey != null) {
            val validPhases = phaseConfigService.getPhases(plan.caseDefinitionKey!!)
            if (updated.phase !in validPhases) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid phase '${updated.phase}'. Valid phases: $validPhases"
                )
            }
        }

        existing.title = updated.title
        existing.description = updated.description
        existing.goalType = updated.goalType
        existing.status = updated.status
        existing.phase = updated.phase
        existing.startDate = updated.startDate
        existing.targetEndDate = updated.targetEndDate
        existing.progressScore = updated.progressScore
        existing.progressExplanation = updated.progressExplanation
        existing.updatedAt = LocalDateTime.now()
        return goalRepository.save(existing)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        goalRepository.delete(existing)
    }
}
