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

import com.ritense.pdca.domain.Plan
import com.ritense.pdca.domain.SubjectType
import com.ritense.pdca.service.PlanService
import com.ritense.pdca.web.rest.dto.CreatePlanRequest
import com.ritense.pdca.web.rest.dto.PlanResponse
import com.ritense.pdca.web.rest.dto.UpdatePlanRequest
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
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@CrossOrigin
@RequestMapping("/api/v1/plans", produces = [MediaType.APPLICATION_JSON_VALUE])
class PlanResource(
    private val planService: PlanService
) {

    @PostMapping
    fun createPlan(
        @Valid @RequestBody request: CreatePlanRequest
    ): ResponseEntity<PlanResponse> {
        val plan = planService.create(
            Plan(
                subjectType = request.subjectType,
                subjectId = request.subjectId,
                title = request.title,
                mainGoal = request.mainGoal,
                startSituation = request.startSituation,
                desiredSituation = request.desiredSituation,
                startDate = request.startDate,
                targetEndDate = request.targetEndDate,
                caseId = request.caseId,
                caseDefinitionKey = request.caseDefinitionKey
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(PlanResponse(plan))
    }

    @GetMapping("/{id}")
    fun getPlan(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<PlanResponse> {
        val plan = planService.getById(id)
        return ResponseEntity.ok(PlanResponse(plan))
    }

    @GetMapping
    fun findAll(): ResponseEntity<List<PlanResponse>> {
        val plans = planService.findAll()
        return ResponseEntity.ok(plans.map { PlanResponse(it) })
    }

    @GetMapping(params = ["subjectId", "subjectType"])
    fun findBySubject(
        @RequestParam(name = "subjectId") subjectId: String,
        @RequestParam(name = "subjectType") subjectType: SubjectType
    ): ResponseEntity<List<PlanResponse>> {
        val plans = planService.findBySubject(subjectId, subjectType)
        return ResponseEntity.ok(plans.map { PlanResponse(it) })
    }

    @GetMapping(params = ["caseId"])
    fun findByCaseId(
        @RequestParam(name = "caseId") caseId: UUID
    ): ResponseEntity<List<PlanResponse>> {
        val plans = planService.findByCaseId(caseId)
        return ResponseEntity.ok(plans.map { PlanResponse(it) })
    }

    @PatchMapping("/{id}")
    fun updatePlan(
        @PathVariable(name = "id") id: UUID,
        @Valid @RequestBody request: UpdatePlanRequest
    ): ResponseEntity<PlanResponse> {
        val existing = planService.getById(id)
        val updated = existing.copy(
            title = request.title ?: existing.title,
            mainGoal = request.mainGoal ?: existing.mainGoal,
            startSituation = request.startSituation ?: existing.startSituation,
            desiredSituation = request.desiredSituation ?: existing.desiredSituation,
            status = request.status ?: existing.status,
            startDate = request.startDate ?: existing.startDate,
            targetEndDate = request.targetEndDate ?: existing.targetEndDate,
            actualEndDate = request.actualEndDate ?: existing.actualEndDate,
            caseId = request.caseId ?: existing.caseId,
            caseDefinitionKey = request.caseDefinitionKey ?: existing.caseDefinitionKey
        )
        val plan = planService.update(id, updated)
        return ResponseEntity.ok(PlanResponse(plan))
    }

    @DeleteMapping("/{id}")
    fun deletePlan(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<Unit> {
        planService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
