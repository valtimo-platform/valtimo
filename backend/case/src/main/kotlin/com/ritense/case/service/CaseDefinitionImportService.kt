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

import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.importer.ImportService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.transaction.annotation.Transactional
import java.io.InputStream
import java.util.UUID

@Transactional
class CaseDefinitionImportService(
    private val importService: ImportService,
    private val caseDefinitionService: CaseDefinitionService,
    private val caseDefinitionRepository: CaseDefinitionRepository,
) {

    fun import(
        inputStream: InputStream,
        keyOverride: String? = null,
        nameOverride: String? = null,
        pluginConfigurationMappings: Map<UUID, UUID?>? = null,
    ): CaseDefinitionId? {
        val skipImportOfCaseDefinitions = caseDefinitionRepository.findAllByFinalTrue().map { it.id }
        val caseDefinitionId = importService.import(
            inputStream,
            skipImportOfCaseDefinitions,
            keyOverride,
            nameOverride,
            pluginConfigurationMappings,
        )
        caseDefinitionService.setLatestToActiveIfNoneIsActive()
        return caseDefinitionId
    }
}
