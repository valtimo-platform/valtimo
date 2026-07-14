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

import com.ritense.pdca.domain.Plan
import com.ritense.pdca.domain.SubjectType
import com.ritense.pdca.repository.PlanRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class PlanService(
    private val planRepository: PlanRepository,
    private val phaseConfigService: PhaseConfigService
) {

    fun findAll(): List<Plan> {
        return planRepository.findAll()
    }

    fun getById(id: UUID): Plan {
        return planRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found with id: $id") }
    }

    fun findByCaseId(caseId: UUID): List<Plan> {
        return planRepository.findByCaseId(caseId)
    }

    fun findBySubject(subjectId: String, subjectType: SubjectType): List<Plan> {
        return planRepository.findBySubjectIdAndSubjectType(subjectId, subjectType)
    }

    fun findByCaseDefinitionKey(caseDefinitionKey: String): List<Plan> {
        return planRepository.findByCaseDefinitionKey(caseDefinitionKey)
    }

    fun create(plan: Plan): Plan {
        if (plan.caseDefinitionKey != null) {
            phaseConfigService.findByCaseDefinitionKey(plan.caseDefinitionKey!!)
                ?: throw ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "No PhaseConfig found for caseDefinitionKey: ${plan.caseDefinitionKey}"
                )
        }
        return planRepository.save(plan)
    }

    fun update(id: UUID, updated: Plan): Plan {
        val existing = getById(id)
        existing.title = updated.title
        existing.mainGoal = updated.mainGoal
        existing.startSituation = updated.startSituation
        existing.desiredSituation = updated.desiredSituation
        existing.status = updated.status
        existing.startDate = updated.startDate
        existing.targetEndDate = updated.targetEndDate
        existing.actualEndDate = updated.actualEndDate
        existing.caseId = updated.caseId
        existing.caseDefinitionKey = updated.caseDefinitionKey
        existing.updatedAt = LocalDateTime.now()
        return planRepository.save(existing)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        planRepository.delete(existing)
    }
}
