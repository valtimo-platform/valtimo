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

package com.ritense.case_.caseconfiguration.importer

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_CONFIGURATION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseConfigurationImporter(
    private val objectMapper: ObjectMapper,
    private val caseConfigurationService: CaseConfigurationService,
) : Importer {
    override fun type() = CASE_CONFIGURATION

    override fun dependsOn() = setOf(CASE_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId!!
        val declarations = try {
            objectMapper.readValue(
                request.content.toString(Charsets.UTF_8),
                object : TypeReference<List<CaseConfigurationDto>>() {}
            )
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as valid case configuration: ${e.message}", e)
        }
        runWithoutAuthorization {
            declarations.forEach {
                if (caseConfigurationService.exists(caseDefinitionId, it.key)) {
                    caseConfigurationService.updateDeclaration(caseDefinitionId, it.key, it.defaultValue)
                } else {
                    caseConfigurationService.createDeclaration(caseDefinitionId, it.key, it.defaultValue)
                }
            }
        }
    }

    private companion object {
        val FILENAME_REGEX = """/case/configuration/([^/]+)\.case-configuration\.json""".toRegex()
    }
}
