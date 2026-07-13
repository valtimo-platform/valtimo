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

import com.ritense.pdca.domain.Evaluation
import com.ritense.pdca.repository.EvaluationRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class EvaluationService(
    private val evaluationRepository: EvaluationRepository,
    private val planService: PlanService,
    private val phaseConfigService: PhaseConfigService
) {

    fun getById(id: UUID): Evaluation {
        return evaluationRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation not found with id: $id") }
    }

    fun findByPlanId(planId: UUID): List<Evaluation> {
        return evaluationRepository.findByPlanIdOrderByScheduledDateDesc(planId)
    }

    fun create(evaluation: Evaluation): Evaluation {
        val plan = planService.getById(evaluation.planId)

        if (plan.caseDefinitionKey != null) {
            val validEvalTypes = phaseConfigService.getEvaluationTypes(plan.caseDefinitionKey!!)
            if (evaluation.evalType !in validEvalTypes) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid evalType '${evaluation.evalType}'. Valid types: $validEvalTypes"
                )
            }
        }

        return evaluationRepository.save(evaluation)
    }

    fun update(id: UUID, updated: Evaluation): Evaluation {
        val existing = getById(id)
        val plan = planService.getById(existing.planId)

        if (plan.caseDefinitionKey != null) {
            val validEvalTypes = phaseConfigService.getEvaluationTypes(plan.caseDefinitionKey!!)
            if (updated.evalType !in validEvalTypes) {
                throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid evalType '${updated.evalType}'. Valid types: $validEvalTypes"
                )
            }
        }

        existing.evalType = updated.evalType
        existing.status = updated.status
        existing.scheduledDate = updated.scheduledDate
        existing.actualDate = updated.actualDate
        existing.summary = updated.summary
        existing.participants = updated.participants
        existing.goalProgress = updated.goalProgress
        existing.actionPoints = updated.actionPoints
        existing.updatedAt = LocalDateTime.now()
        return evaluationRepository.save(existing)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        evaluationRepository.delete(existing)
    }
}
