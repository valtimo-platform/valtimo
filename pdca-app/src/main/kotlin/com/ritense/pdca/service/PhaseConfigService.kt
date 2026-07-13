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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.pdca.domain.PhaseConfig
import com.ritense.pdca.repository.PhaseConfigRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDateTime
import java.util.UUID

@Service
@Transactional
class PhaseConfigService(
    private val phaseConfigRepository: PhaseConfigRepository,
    private val objectMapper: ObjectMapper
) {

    fun getById(id: UUID): PhaseConfig {
        return phaseConfigRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "PhaseConfig not found with id: $id") }
    }

    fun getByCaseDefinitionKey(caseDefinitionKey: String): PhaseConfig {
        return phaseConfigRepository.findByCaseDefinitionKey(caseDefinitionKey)
            ?: throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "PhaseConfig not found for caseDefinitionKey: $caseDefinitionKey"
            )
    }

    fun findByCaseDefinitionKey(caseDefinitionKey: String): PhaseConfig? {
        return phaseConfigRepository.findByCaseDefinitionKey(caseDefinitionKey)
    }

    fun create(phaseConfig: PhaseConfig): PhaseConfig {
        return phaseConfigRepository.save(phaseConfig)
    }

    fun update(id: UUID, updated: PhaseConfig): PhaseConfig {
        val existing = getById(id)
        existing.phases = updated.phases
        existing.evaluationTypes = updated.evaluationTypes
        existing.updatedAt = LocalDateTime.now()
        return phaseConfigRepository.save(existing)
    }

    fun getAll(): List<PhaseConfig> {
        return phaseConfigRepository.findAll()
    }

    fun delete(id: UUID) {
        val existing = getById(id)
        phaseConfigRepository.delete(existing)
    }

    fun deleteByCaseDefinitionKey(caseDefinitionKey: String) {
        val existing = getByCaseDefinitionKey(caseDefinitionKey)
        phaseConfigRepository.delete(existing)
    }

    fun updateByCaseDefinitionKey(caseDefinitionKey: String, updated: PhaseConfig): PhaseConfig {
        val existing = getByCaseDefinitionKey(caseDefinitionKey)
        existing.phases = updated.phases
        existing.evaluationTypes = updated.evaluationTypes
        existing.updatedAt = LocalDateTime.now()
        return phaseConfigRepository.save(existing)
    }

    fun getPhases(caseDefinitionKey: String): List<String> {
        val config = getByCaseDefinitionKey(caseDefinitionKey)
        return objectMapper.readValue(config.phases, object : TypeReference<List<String>>() {})
    }

    fun getEvaluationTypes(caseDefinitionKey: String): List<String> {
        val config = getByCaseDefinitionKey(caseDefinitionKey)
        return objectMapper.readValue(config.evaluationTypes, object : TypeReference<List<String>>() {})
    }
}
