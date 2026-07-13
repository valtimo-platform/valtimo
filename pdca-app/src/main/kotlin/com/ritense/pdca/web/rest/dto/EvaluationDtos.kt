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

import com.ritense.pdca.domain.Evaluation
import com.ritense.pdca.domain.EvaluationStatus
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

data class CreateEvaluationRequest(
    val evalType: String,
    val scheduledDate: LocalDate? = null,
    val participants: String? = null
)

data class UpdateEvaluationRequest(
    val evalType: String? = null,
    val status: EvaluationStatus? = null,
    val scheduledDate: LocalDate? = null,
    val actualDate: LocalDate? = null,
    val summary: String? = null,
    val participants: String? = null,
    val goalProgress: String? = null,
    val actionPoints: String? = null
)

data class EvaluationResponse(
    val id: UUID,
    val planId: UUID,
    val evalType: String,
    val status: EvaluationStatus,
    val scheduledDate: LocalDate?,
    val actualDate: LocalDate?,
    val summary: String?,
    val participants: String?,
    val goalProgress: String?,
    val actionPoints: String?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
) {
    constructor(evaluation: Evaluation) : this(
        id = evaluation.id,
        planId = evaluation.planId,
        evalType = evaluation.evalType,
        status = evaluation.status,
        scheduledDate = evaluation.scheduledDate,
        actualDate = evaluation.actualDate,
        summary = evaluation.summary,
        participants = evaluation.participants,
        goalProgress = evaluation.goalProgress,
        actionPoints = evaluation.actionPoints,
        createdAt = evaluation.createdAt,
        updatedAt = evaluation.updatedAt
    )
}
