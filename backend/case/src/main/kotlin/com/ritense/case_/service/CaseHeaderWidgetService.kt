/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 */

package com.ritense.case_.service

import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetUpdateDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
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
    fun findById(id: CaseHeaderWidgetId): CaseHeaderWidgetDto? =
        repository.findByIdOrNull(id)?.let { CaseHeaderWidgetDto.of(it) }

    @Transactional
    fun create(
        caseDefinitionKey: String,
        caseDefinitionVersionTag: String,
        @Valid dto: CaseHeaderWidgetCreateDto
    ): CaseHeaderWidgetDto {
        val id = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionVersionTag)
        if (repository.existsById(id)) {
            throw IllegalArgumentException("CaseHeaderWidget with id '$id' already exists.")
        }
        val entity: CaseHeaderWidget =
            CaseHeaderWidgetDto.toEntity(caseDefinitionKey, caseDefinitionVersionTag, dto)

        val saved = repository.save(entity)
        return CaseHeaderWidgetDto.of(saved)
    }

    @Transactional
    fun update(id: CaseHeaderWidgetId, @Valid dto: CaseHeaderWidgetUpdateDto): CaseHeaderWidgetDto {
        val existing = repository.findByIdOrNull(id)
            ?: throw NoSuchElementException("CaseHeaderWidget with id '$id' not found.")

        val updated: CaseHeaderWidget = existing.copy(
            id = id,
            title = dto.title,
            highContrast = dto.highContrast,
            properties = dto.properties
        )

        return CaseHeaderWidgetDto.of(repository.save(updated))
    }

    @Transactional
    fun delete(id: CaseHeaderWidgetId) {
        if (!repository.existsById(id)) {
            throw NoSuchElementException("CaseHeaderWidget with id '$id' not found.")
        }
        repository.deleteById(id)
    }
}