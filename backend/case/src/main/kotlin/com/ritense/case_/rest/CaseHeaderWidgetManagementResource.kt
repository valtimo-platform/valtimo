/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 */

package com.ritense.case_.rest

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetUpdateDto
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseHeaderWidgetManagementResource(
    private val caseHeaderWidgetService: CaseHeaderWidgetService
) {

    @PostMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget")
    fun create(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @Valid @RequestBody dto: CaseHeaderWidgetCreateDto
    ): ResponseEntity<CaseHeaderWidgetDto> {
        val created = runWithoutAuthorization {
            caseHeaderWidgetService.create(caseDefinitionKey, caseDefinitionVersionTag, dto)
        }
        return ResponseEntity.ok(created)
    }

    @GetMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget")
    fun get(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<CaseHeaderWidgetDto> {
        val id = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionVersionTag)
        val widget = runWithoutAuthorization {
            caseHeaderWidgetService.findById(id)
        }
        return ResponseEntity.ofNullable(widget)
    }

    @PutMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget")
    fun update(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
        @Valid @RequestBody dto: CaseHeaderWidgetUpdateDto
    ): ResponseEntity<CaseHeaderWidgetDto> {
        val id = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionVersionTag)
        val updated = runWithoutAuthorization {
            caseHeaderWidgetService.update(id, dto)
        }
        return ResponseEntity.ok(updated)
    }

    @DeleteMapping("/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget")
    fun delete(
        @PathVariable caseDefinitionKey: String,
        @PathVariable caseDefinitionVersionTag: String,
    ): ResponseEntity<Void> {
        val id = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionVersionTag)
        runWithoutAuthorization {
            caseHeaderWidgetService.delete(id)
        }
        return ResponseEntity.noContent().build()
    }
}