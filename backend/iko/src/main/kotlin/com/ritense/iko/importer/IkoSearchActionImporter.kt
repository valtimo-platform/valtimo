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

package com.ritense.iko.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_VIEW
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_SEARCH_ACTION
import org.springframework.transaction.annotation.Transactional

@Transactional
class IkoSearchActionImporter(
    private val objectMapper: ObjectMapper,
    private val service: IkoSearchActionService,
    private val ikoViewService: IkoViewService,
) : Importer {
    override fun type() = IKO_SEARCH_ACTION

    override fun dependsOn(): Set<String> = setOf(IKO_VIEW)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val fileContent = request.content.toString(Charsets.UTF_8)
        val ikoSearchActionsDto = objectMapper.readValue<IkoSearchActionsDto>(fileContent)

        val ikoView = ikoViewService.getByKey(ikoSearchActionsDto.ikoViewKey)
        val existingIkoSearchActions = service.findAll(ikoViewKey = ikoSearchActionsDto.ikoViewKey)

        ikoSearchActionsDto.ikoSearchActions.forEachIndexed { index, ikoSearchActionDto ->
            val ikoSearchActionExists = existingIkoSearchActions
                .any { existingIkoSearchAction -> existingIkoSearchAction.id.key == ikoSearchActionDto.key }
            val ikoSearchAction = ikoSearchActionDto.toEntity(ikoView, index)
            if (ikoSearchActionExists) {
                service.update(ikoSearchAction)
            } else {
                service.create(ikoSearchAction)
            }
        }

        existingIkoSearchActions
            .filter { existingIkoSearchAction -> ikoSearchActionsDto.ikoSearchActions.none { ikoSearchActionDto -> ikoSearchActionDto.key == existingIkoSearchAction.id.key } }
            .forEach { existingIkoSearchAction ->
                service.delete(
                    ikoViewKey = ikoSearchActionsDto.ikoViewKey,
                    key = existingIkoSearchAction.id.key
                )
            }
    }

    override fun partOfCaseDefinition(): Boolean = false

    private companion object {
        private val FILENAME_REGEX = """/global/iko/(?:.*/)?(.+)\.iko-search-action\.json""".toRegex()
    }
}
