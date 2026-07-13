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

import com.ritense.pdca.domain.Instrument
import com.ritense.pdca.service.GoalService
import com.ritense.pdca.service.InstrumentService
import com.ritense.pdca.web.rest.dto.CreateInstrumentRequest
import com.ritense.pdca.web.rest.dto.InstrumentResponse
import com.ritense.pdca.web.rest.dto.UpdateInstrumentRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
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
class InstrumentResource(
    private val instrumentService: InstrumentService,
    private val goalService: GoalService
) {

    @PostMapping("/goals/{goalId}/instruments")
    fun createInstrument(
        @PathVariable(name = "goalId") goalId: UUID,
        @Valid @RequestBody request: CreateInstrumentRequest
    ): ResponseEntity<InstrumentResponse> {
        val instrument = instrumentService.create(
            Instrument(
                goalId = goalId,
                title = request.title,
                externalProductId = request.externalProductId,
                providerName = request.providerName,
                category = request.category,
                startDate = request.startDate,
                endDate = request.endDate
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(InstrumentResponse(instrument))
    }

    @GetMapping("/plans/{planId}/instruments")
    fun findByPlanId(
        @PathVariable(name = "planId") planId: UUID
    ): ResponseEntity<List<InstrumentResponse>> {
        val goals = goalService.findByPlanId(planId)
        val goalIds = goals.map { it.id }
        val instruments = if (goalIds.isEmpty()) emptyList() else instrumentService.findByGoalIds(goalIds)
        return ResponseEntity.ok(instruments.map { InstrumentResponse(it) })
    }

    @GetMapping("/instruments/{id}")
    fun getInstrument(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<InstrumentResponse> {
        val instrument = instrumentService.getById(id)
        return ResponseEntity.ok(InstrumentResponse(instrument))
    }

    @PatchMapping("/instruments/{id}")
    fun updateInstrument(
        @PathVariable(name = "id") id: UUID,
        @Valid @RequestBody request: UpdateInstrumentRequest
    ): ResponseEntity<InstrumentResponse> {
        val existing = instrumentService.getById(id)
        val updated = existing.copy(
            title = request.title ?: existing.title,
            externalProductId = request.externalProductId ?: existing.externalProductId,
            providerName = request.providerName ?: existing.providerName,
            category = request.category ?: existing.category,
            status = request.status ?: existing.status,
            startDate = request.startDate ?: existing.startDate,
            endDate = request.endDate ?: existing.endDate,
            result = request.result ?: existing.result
        )
        val instrument = instrumentService.update(id, updated)
        return ResponseEntity.ok(InstrumentResponse(instrument))
    }
}
