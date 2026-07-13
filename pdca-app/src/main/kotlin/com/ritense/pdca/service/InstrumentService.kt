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

import com.ritense.pdca.domain.Instrument
import com.ritense.pdca.repository.InstrumentRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class InstrumentService(
    private val instrumentRepository: InstrumentRepository,
    private val goalService: GoalService
) {

    fun getById(id: UUID): Instrument {
        return instrumentRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Instrument not found with id: $id") }
    }

    fun findByGoalId(goalId: UUID): List<Instrument> {
        return instrumentRepository.findByGoalId(goalId)
    }

    fun findByGoalIds(goalIds: List<UUID>): List<Instrument> {
        return instrumentRepository.findByGoalIdIn(goalIds)
    }

    fun create(instrument: Instrument): Instrument {
        goalService.getById(instrument.goalId)
        return instrumentRepository.save(instrument)
    }

    fun update(id: UUID, updated: Instrument): Instrument {
        val existing = getById(id)
        existing.title = updated.title
        existing.externalProductId = updated.externalProductId
        existing.providerName = updated.providerName
        existing.category = updated.category
        existing.status = updated.status
        existing.startDate = updated.startDate
        existing.endDate = updated.endDate
        existing.result = updated.result
        existing.updatedAt = LocalDateTime.now()
        return instrumentRepository.save(existing)
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        instrumentRepository.delete(existing)
    }
}
