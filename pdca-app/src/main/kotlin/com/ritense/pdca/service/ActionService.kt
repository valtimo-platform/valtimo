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

import com.ritense.pdca.domain.Action
import com.ritense.pdca.domain.ActionStatus
import com.ritense.pdca.repository.ActionRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class ActionService(
    private val actionRepository: ActionRepository,
    private val goalService: GoalService
) {

    fun getById(id: UUID): Action {
        return actionRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Action not found with id: $id") }
    }

    fun findByGoalId(goalId: UUID): List<Action> {
        return actionRepository.findByGoalId(goalId)
    }

    fun findByGoalIds(goalIds: List<UUID>): List<Action> {
        return actionRepository.findByGoalIdIn(goalIds)
    }

    fun create(action: Action): Action {
        goalService.getById(action.goalId)
        return actionRepository.save(action)
    }

    fun update(id: UUID, updated: Action): Action {
        val existing = getById(id)
        existing.title = updated.title
        existing.description = updated.description
        existing.status = updated.status
        existing.assigneeType = updated.assigneeType
        existing.assigneeName = updated.assigneeName
        existing.priority = updated.priority
        existing.startDate = updated.startDate
        existing.dueDate = updated.dueDate
        existing.completedDate = updated.completedDate
        existing.result = updated.result
        existing.updatedAt = LocalDateTime.now()
        return actionRepository.save(existing)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        actionRepository.delete(existing)
    }

    fun submitForReview(id: UUID): Action {
        val action = getById(id)
        if (action.status != ActionStatus.IN_PROGRESS) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Action must be IN_PROGRESS to submit for review. Current status: ${action.status}"
            )
        }
        action.status = ActionStatus.PENDING_REVIEW
        action.updatedAt = LocalDateTime.now()
        return actionRepository.save(action)
    }

    fun approve(id: UUID): Action {
        val action = getById(id)
        if (action.status != ActionStatus.PENDING_REVIEW) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Action must be PENDING_REVIEW to approve. Current status: ${action.status}"
            )
        }
        action.status = ActionStatus.COMPLETED
        action.completedDate = LocalDate.now()
        action.updatedAt = LocalDateTime.now()
        return actionRepository.save(action)
    }

    fun reject(id: UUID): Action {
        val action = getById(id)
        if (action.status != ActionStatus.PENDING_REVIEW) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Action must be PENDING_REVIEW to reject. Current status: ${action.status}"
            )
        }
        action.status = ActionStatus.REJECTED
        action.updatedAt = LocalDateTime.now()
        return actionRepository.save(action)
    }
}
