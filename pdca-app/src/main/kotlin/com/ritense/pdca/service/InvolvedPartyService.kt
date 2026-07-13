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

import com.ritense.pdca.domain.InvolvedParty
import com.ritense.pdca.repository.InvolvedPartyRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
@Transactional
class InvolvedPartyService(
    private val involvedPartyRepository: InvolvedPartyRepository,
    private val planService: PlanService
) {

    fun getById(id: UUID): InvolvedParty {
        return involvedPartyRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "InvolvedParty not found with id: $id") }
    }

    fun findByPlanId(planId: UUID): List<InvolvedParty> {
        return involvedPartyRepository.findByPlanId(planId)
    }

    fun create(involvedParty: InvolvedParty): InvolvedParty {
        planService.getById(involvedParty.planId)
        return involvedPartyRepository.save(involvedParty)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        involvedPartyRepository.delete(existing)
    }
}
