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

import com.ritense.pdca.domain.Plan
import com.ritense.pdca.domain.PlanStatus
import com.ritense.pdca.domain.SubjectType
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class CreatePlanRequest(
    val subjectType: SubjectType,
    val subjectId: String,
    val title: String,
    val mainGoal: String? = null,
    val startSituation: String? = null,
    val desiredSituation: String? = null,
    val startDate: LocalDate? = null,
    val targetEndDate: LocalDate? = null,
    val caseId: UUID? = null,
    val caseDefinitionKey: String? = null
)

data class UpdatePlanRequest(
    val title: String? = null,
    val mainGoal: String? = null,
    val startSituation: String? = null,
    val desiredSituation: String? = null,
    val status: PlanStatus? = null,
    val startDate: LocalDate? = null,
    val targetEndDate: LocalDate? = null,
    val actualEndDate: LocalDate? = null,
    val caseId: UUID? = null,
    val caseDefinitionKey: String? = null
)

data class PlanResponse(
    val id: UUID,
    val subjectType: SubjectType,
    val subjectId: String,
    val title: String,
    val mainGoal: String?,
    val startSituation: String?,
    val desiredSituation: String?,
    val status: PlanStatus,
    val startDate: LocalDate?,
    val targetEndDate: LocalDate?,
    val actualEndDate: LocalDate?,
    val caseId: UUID?,
    val caseDefinitionKey: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
    val createdBy: String?
) {
    constructor(plan: Plan) : this(
        id = plan.id,
        subjectType = plan.subjectType,
        subjectId = plan.subjectId,
        title = plan.title,
        mainGoal = plan.mainGoal,
        startSituation = plan.startSituation,
        desiredSituation = plan.desiredSituation,
        status = plan.status,
        startDate = plan.startDate,
        targetEndDate = plan.targetEndDate,
        actualEndDate = plan.actualEndDate,
        caseId = plan.caseId,
        caseDefinitionKey = plan.caseDefinitionKey,
        createdAt = plan.createdAt,
        updatedAt = plan.updatedAt,
        createdBy = plan.createdBy
    )
}
