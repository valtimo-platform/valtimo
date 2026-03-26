/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.case.service

import CaseDefinitionDto
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.web.rest.dto.CaseDefinitionImportPreviewResponse
import com.ritense.importer.exception.ImportServiceException
import java.io.InputStream
import java.util.zip.ZipInputStream

class CaseDefinitionImportPreviewService(
    private val objectMapper: ObjectMapper,
) {
    fun preview(inputStream: InputStream): CaseDefinitionImportPreviewResponse {
        val caseDefContent = findCaseDefinitionEntry(inputStream)
            ?: throw ImportServiceException("No .case-definition.json found in ZIP")
        val dto = objectMapper.readValue(caseDefContent, CaseDefinitionDto::class.java)
        return CaseDefinitionImportPreviewResponse(
            key = dto.key,
            name = dto.name,
            versionTag = dto.versionTag,
            isFinal = dto.final,
        )
    }

    private fun findCaseDefinitionEntry(inputStream: InputStream): ByteArray? {
        ZipInputStream(inputStream).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory && entry.name.matches(CASE_DEFINITION_REGEX)) {
                    return zis.readBytes()
                }
                entry = zis.nextEntry
            }
        }
        return null
    }

    private companion object {
        val CASE_DEFINITION_REGEX =
            """.*/?case/definition/[^/]+\.case-definition\.json""".toRegex()
    }
}
