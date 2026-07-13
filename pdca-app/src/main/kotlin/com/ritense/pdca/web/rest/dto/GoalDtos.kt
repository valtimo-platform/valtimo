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

package com.ritense.pdca.web.rest.dto

import com.ritense.pdca.domain.Goal
import com.ritense.pdca.domain.GoalStatus
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class CreateGoalRequest(
    val title: String,
    val description: String? = null,
    val goalType: String? = null,
    val phase: String,
    val startDate: LocalDate? = null,
    val targetEndDate: LocalDate? = null,
    val sortOrder: Int = 0
)

data class UpdateGoalRequest(
    val title: String? = null,
    val description: String? = null,
    val goalType: String? = null,
    val status: GoalStatus? = null,
    val phase: String? = null,
    val startDate: LocalDate? = null,
    val targetEndDate: LocalDate? = null,
    val progressScore: Int? = null,
    val progressExplanation: String? = null,
    val sortOrder: Int? = null
)

data class GoalResponse(
    val id: UUID,
    val planId: UUID,
    val title: String,
    val description: String?,
    val goalType: String?,
    val status: GoalStatus,
    val phase: String,
    val startDate: LocalDate?,
    val targetEndDate: LocalDate?,
    val progressScore: Int?,
    val progressExplanation: String?,
    val sortOrder: Int,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
) {
    constructor(goal: Goal) : this(
        id = goal.id,
        planId = goal.planId,
        title = goal.title,
        description = goal.description,
        goalType = goal.goalType,
        status = goal.status,
        phase = goal.phase,
        startDate = goal.startDate,
        targetEndDate = goal.targetEndDate,
        progressScore = goal.progressScore,
        progressExplanation = goal.progressExplanation,
        sortOrder = goal.sortOrder,
        createdAt = goal.createdAt,
        updatedAt = goal.updatedAt
    )
}
