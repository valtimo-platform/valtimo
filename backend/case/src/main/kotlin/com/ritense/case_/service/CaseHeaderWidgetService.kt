/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.case_.service

import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetUpdateDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.validation.Valid
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.validation.annotation.Validated

@Validated
@Service
@SkipComponentScan
@Transactional(readOnly = true)
class CaseHeaderWidgetService(
    private val repository: CaseHeaderWidgetRepository
) {

    @Transactional(readOnly = true)
    fun findById(id: CaseDefinitionId): CaseHeaderWidgetDto? =
        repository.findByIdOrNull(id)?.let { CaseHeaderWidgetDto.of(it) }

    @Transactional
    fun create(
        caseDefinitionKey: String,
        caseDefinitionVersionTag: String,
        @Valid dto: CaseHeaderWidgetCreateDto
    ): CaseHeaderWidgetDto {
        val id = CaseDefinitionId(caseDefinitionKey, caseDefinitionVersionTag)
        if (repository.existsById(id)) {
            throw IllegalArgumentException("CaseHeaderWidget with id '$id' already exists.")
        }
        val entity: CaseHeaderWidget =
            CaseHeaderWidgetDto.toEntity(caseDefinitionKey, caseDefinitionVersionTag, dto)

        val saved = repository.save(entity)
        return CaseHeaderWidgetDto.of(saved)
    }

    @Transactional
    fun update(id: CaseDefinitionId, @Valid dto: CaseHeaderWidgetUpdateDto): CaseHeaderWidgetDto {
        val existing = repository.findByIdOrNull(id)
            ?: throw NoSuchElementException("CaseHeaderWidget with id '$id' not found.")

        val updated: CaseHeaderWidget = existing.copy(
            id = id,
            highContrast = dto.highContrast,
            properties = dto.properties
        )

        return CaseHeaderWidgetDto.of(repository.save(updated))
    }

    @Transactional
    fun delete(id: CaseDefinitionId) {
        if (!repository.existsById(id)) {
            throw NoSuchElementException("CaseHeaderWidget with id '$id' not found.")
        }
        repository.deleteById(id)
    }
}