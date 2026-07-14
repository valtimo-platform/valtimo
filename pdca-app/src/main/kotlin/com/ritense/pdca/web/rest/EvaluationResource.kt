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

import com.ritense.pdca.domain.Evaluation
import com.ritense.pdca.service.EvaluationService
import com.ritense.pdca.web.rest.dto.CreateEvaluationRequest
import com.ritense.pdca.web.rest.dto.EvaluationResponse
import com.ritense.pdca.web.rest.dto.UpdateEvaluationRequest
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
class EvaluationResource(
    private val evaluationService: EvaluationService
) {

    @PostMapping("/plans/{planId}/evaluations")
    fun createEvaluation(
        @PathVariable(name = "planId") planId: UUID,
        @Valid @RequestBody request: CreateEvaluationRequest
    ): ResponseEntity<EvaluationResponse> {
        val evaluation = evaluationService.create(
            Evaluation(
                planId = planId,
                evalType = request.evalType,
                scheduledDate = request.scheduledDate,
                participants = request.participants
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(EvaluationResponse(evaluation))
    }

    @GetMapping("/plans/{planId}/evaluations")
    fun findByPlanId(
        @PathVariable(name = "planId") planId: UUID
    ): ResponseEntity<List<EvaluationResponse>> {
        val evaluations = evaluationService.findByPlanId(planId)
        return ResponseEntity.ok(evaluations.map { EvaluationResponse(it) })
    }

    @GetMapping("/evaluations/{id}")
    fun getEvaluation(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<EvaluationResponse> {
        val evaluation = evaluationService.getById(id)
        return ResponseEntity.ok(EvaluationResponse(evaluation))
    }

    @PatchMapping("/evaluations/{id}")
    fun updateEvaluation(
        @PathVariable(name = "id") id: UUID,
        @Valid @RequestBody request: UpdateEvaluationRequest
    ): ResponseEntity<EvaluationResponse> {
        val existing = evaluationService.getById(id)
        val updated = existing.copy(
            evalType = request.evalType ?: existing.evalType,
            status = request.status ?: existing.status,
            scheduledDate = request.scheduledDate ?: existing.scheduledDate,
            actualDate = request.actualDate ?: existing.actualDate,
            summary = request.summary ?: existing.summary,
            participants = request.participants ?: existing.participants,
            goalProgress = request.goalProgress ?: existing.goalProgress,
            actionPoints = request.actionPoints ?: existing.actionPoints
        )
        val evaluation = evaluationService.update(id, updated)
        return ResponseEntity.ok(EvaluationResponse(evaluation))
    }

    @DeleteMapping("/evaluations/{id}")
    fun deleteEvaluation(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<Unit> {
        evaluationService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
