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
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_SEARCH_ACTION
import com.ritense.importer.ValtimoImportTypes.Companion.IKO_SEARCH_FIELD

class IkoSearchFieldImporter(
    private val objectMapper: ObjectMapper,
    private val service: IkoSearchFieldService,
) : Importer {

    override fun type(): String = IKO_SEARCH_FIELD

    override fun dependsOn(): Set<String> = setOf(IKO_SEARCH_ACTION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val ikoSearchFieldsDto = objectMapper.readValue<IkoSearchFieldsDto>(request.content.toString(Charsets.UTF_8))

        val existingSearchFields = service.findAllSearchFieldsByIkoSearchAction(
            ikoSearchFieldsDto.ikoViewKey,
            ikoSearchFieldsDto.ikoSearchActionKey,
        )

        ikoSearchFieldsDto.ikoSearchFields.forEachIndexed { index, searchFieldDto ->
            val existingSearchFieldId =
                existingSearchFields.firstOrNull { existingSearchField -> existingSearchField.key == searchFieldDto.key }?.id
            if (existingSearchFieldId != null) {
                service.update(
                    ikoSearchFieldsDto.ikoViewKey,
                    ikoSearchFieldsDto.ikoSearchActionKey,
                    searchFieldDto.toEntity(
                        ikoSearchFieldsDto.ikoViewKey,
                        ikoSearchFieldsDto.ikoSearchActionKey,
                        index
                    )
                )
            } else {
                service.create(
                    ikoSearchFieldsDto.ikoViewKey,
                    ikoSearchFieldsDto.ikoSearchActionKey,
                    searchFieldDto.toEntity(
                        ikoSearchFieldsDto.ikoViewKey,
                        ikoSearchFieldsDto.ikoSearchActionKey,
                        index
                    )
                )
            }
        }

        existingSearchFields
            .filter { existingSearchField -> ikoSearchFieldsDto.ikoSearchFields.none { searchFieldDto -> searchFieldDto.key == existingSearchField.key } }
            .forEach { existingSearchField ->
                service.deleteByKey(
                    ikoSearchFieldsDto.ikoViewKey,
                    ikoSearchFieldsDto.ikoSearchActionKey,
                    existingSearchField.key
                )
            }
    }

    override fun partOfCaseDefinition(): Boolean = false

    companion object {
        private val FILENAME_REGEX = """/global/iko/(?:.*/)?(.+)\.iko-search-field\.json""".toRegex()
    }
}
