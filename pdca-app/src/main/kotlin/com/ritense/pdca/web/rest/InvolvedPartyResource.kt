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

import com.ritense.pdca.domain.InvolvedParty
import com.ritense.pdca.service.InvolvedPartyService
import com.ritense.pdca.web.rest.dto.CreateInvolvedPartyRequest
import com.ritense.pdca.web.rest.dto.InvolvedPartyResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@CrossOrigin
@RequestMapping("/api/v1", produces = [MediaType.APPLICATION_JSON_VALUE])
class InvolvedPartyResource(
    private val involvedPartyService: InvolvedPartyService
) {

    @PostMapping("/plans/{planId}/parties")
    fun createInvolvedParty(
        @PathVariable(name = "planId") planId: UUID,
        @Valid @RequestBody request: CreateInvolvedPartyRequest
    ): ResponseEntity<InvolvedPartyResponse> {
        val party = involvedPartyService.create(
            InvolvedParty(
                planId = planId,
                name = request.name,
                role = request.role,
                email = request.email,
                phone = request.phone,
                organization = request.organization,
                isPrimary = request.isPrimary
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(InvolvedPartyResponse(party))
    }

    @GetMapping("/plans/{planId}/parties")
    fun findByPlanId(
        @PathVariable(name = "planId") planId: UUID
    ): ResponseEntity<List<InvolvedPartyResponse>> {
        val parties = involvedPartyService.findByPlanId(planId)
        return ResponseEntity.ok(parties.map { InvolvedPartyResponse(it) })
    }

    @DeleteMapping("/parties/{id}")
    fun deleteInvolvedParty(
        @PathVariable(name = "id") id: UUID
    ): ResponseEntity<Unit> {
        involvedPartyService.delete(id)
        return ResponseEntity.noContent().build()
    }
}
