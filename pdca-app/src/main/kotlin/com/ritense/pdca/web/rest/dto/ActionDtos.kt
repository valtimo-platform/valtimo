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

import com.ritense.pdca.domain.Action
import com.ritense.pdca.domain.ActionStatus
import com.ritense.pdca.domain.AssigneeType
import com.ritense.pdca.domain.Priority
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class CreateActionRequest(
    val title: String,
    val description: String? = null,
    val assigneeType: AssigneeType? = null,
    val assigneeName: String? = null,
    val priority: Priority = Priority.NORMAL,
    val startDate: LocalDate? = null,
    val dueDate: LocalDate? = null
)

data class UpdateActionRequest(
    val title: String? = null,
    val description: String? = null,
    val status: ActionStatus? = null,
    val assigneeType: AssigneeType? = null,
    val assigneeName: String? = null,
    val priority: Priority? = null,
    val startDate: LocalDate? = null,
    val dueDate: LocalDate? = null,
    val completedDate: LocalDate? = null,
    val result: String? = null
)

data class ActionResponse(
    val id: UUID,
    val goalId: UUID,
    val title: String,
    val description: String?,
    val status: ActionStatus,
    val assigneeType: AssigneeType?,
    val assigneeName: String?,
    val priority: Priority,
    val startDate: LocalDate?,
    val dueDate: LocalDate?,
    val completedDate: LocalDate?,
    val result: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
) {
    constructor(action: Action) : this(
        id = action.id,
        goalId = action.goalId,
        title = action.title,
        description = action.description,
        status = action.status,
        assigneeType = action.assigneeType,
        assigneeName = action.assigneeName,
        priority = action.priority,
        startDate = action.startDate,
        dueDate = action.dueDate,
        completedDate = action.completedDate,
        result = action.result,
        createdAt = action.createdAt,
        updatedAt = action.updatedAt
    )
}
