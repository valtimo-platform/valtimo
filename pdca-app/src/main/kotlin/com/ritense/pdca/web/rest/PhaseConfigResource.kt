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

import com.ritense.pdca.domain.PhaseConfig
import com.ritense.pdca.service.PhaseConfigService
import com.ritense.pdca.web.rest.dto.CreatePhaseConfigRequest
import com.ritense.pdca.web.rest.dto.PhaseConfigResponse
import com.ritense.pdca.web.rest.dto.UpdatePhaseConfigRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@CrossOrigin
@RequestMapping("/api/v1/admin/phase-configs", produces = [MediaType.APPLICATION_JSON_VALUE])
class PhaseConfigResource(
    private val phaseConfigService: PhaseConfigService
) {

    @GetMapping
    fun getAll(): ResponseEntity<List<PhaseConfigResponse>> {
        val configs = phaseConfigService.getAll()
        return ResponseEntity.ok(configs.map { PhaseConfigResponse(it) })
    }

    @GetMapping("/{caseDefKey}")
    fun getByCaseDefKey(
        @PathVariable(name = "caseDefKey") caseDefKey: String
    ): ResponseEntity<PhaseConfigResponse> {
        val config = phaseConfigService.getByCaseDefinitionKey(caseDefKey)
        return ResponseEntity.ok(PhaseConfigResponse(config))
    }

    @PostMapping
    fun create(
        @Valid @RequestBody request: CreatePhaseConfigRequest
    ): ResponseEntity<PhaseConfigResponse> {
        val config = phaseConfigService.create(
            PhaseConfig(
                caseDefinitionKey = request.caseDefinitionKey,
                phases = request.phases,
                evaluationTypes = request.evaluationTypes
            )
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(PhaseConfigResponse(config))
    }

    @PutMapping("/{caseDefKey}")
    fun update(
        @PathVariable(name = "caseDefKey") caseDefKey: String,
        @Valid @RequestBody request: UpdatePhaseConfigRequest
    ): ResponseEntity<PhaseConfigResponse> {
        val existing = phaseConfigService.getByCaseDefinitionKey(caseDefKey)
        val updated = existing.copy(
            phases = request.phases ?: existing.phases,
            evaluationTypes = request.evaluationTypes ?: existing.evaluationTypes
        )
        val config = phaseConfigService.updateByCaseDefinitionKey(caseDefKey, updated)
        return ResponseEntity.ok(PhaseConfigResponse(config))
    }

    @DeleteMapping("/{caseDefKey}")
    fun delete(
        @PathVariable(name = "caseDefKey") caseDefKey: String
    ): ResponseEntity<Unit> {
        phaseConfigService.deleteByCaseDefinitionKey(caseDefKey)
        return ResponseEntity.noContent().build()
    }
}
