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

package com.ritense.case_.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_HEADER_WIDGET
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.validation.check
import jakarta.validation.Validator

class CaseHeaderWidgetImporter(
    private val objectMapper: ObjectMapper,
    private val validator: Validator,
    private val caseHeaderWidgetRepository: CaseHeaderWidgetRepository,
) : Importer {
    override fun type() = CASE_HEADER_WIDGET

    override fun dependsOn() = setOf(DOCUMENT_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        return deploy(request.content.toString(Charsets.UTF_8), request.caseDefinitionId!!)
    }

    fun deploy(fileContent: String, caseDefinitionId: CaseDefinitionId) {
        val headerWidget = try {
            objectMapper.readValue(fileContent, object : TypeReference<CaseHeaderWidgetCreateDto>() {})
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as valid case header widget: ${e.message}", e)
        }

        validator.check(headerWidget)

        val widget = CaseHeaderWidget(
            id = CaseHeaderWidgetId(caseDefinitionId.key, caseDefinitionId.versionTag.toString()),
            type = headerWidget.type,
            highContrast = headerWidget.highContrast,
            properties = headerWidget.properties
        )

        caseHeaderWidgetRepository.save(widget)
    }

    private companion object {
        val FILENAME_REGEX = """/case/header-widget/([^/]+)\.case-header-widget\.json""".toRegex()
    }
}