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

package com.ritense.iko.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.iko.authorization.IkoViewActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoSeachActionSearchField
import com.ritense.iko.domain.IkoSeachActionSearchFieldId
import com.ritense.iko.repository.IkoSeachActionSearchFieldRepository
import com.ritense.search.domain.SearchFieldV2
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.web.rest.dto.SearchFieldV2Dto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@SkipComponentScan
@Service
class IkoSearchFieldService(
    private val searchFieldService: SearchFieldV2Service,
    private val ikoSeachActionSearchFieldRepository: IkoSeachActionSearchFieldRepository,
    private val ikoViewService: IkoViewService,
) {

    fun findByKey(ikoViewKey: String, ikoSeachActionKey: String, searchFieldKey: String): SearchFieldV2? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoSeachActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
            ikoViewKey,
            ikoSeachActionKey,
            searchFieldKey
        )?.searchField
    }

    fun getByKey(ikoViewKey: String, ikoSeachActionKey: String, searchFieldKey: String): SearchFieldV2 {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return findByKey(ikoViewKey, ikoSeachActionKey, searchFieldKey)
            ?: error("Unknown searchField key: $searchFieldKey")
    }

    fun findAllSearchFieldsByIkoSeachAction(
        ikoViewKey: String,
        ikoSeachActionKey: String
    ): List<SearchFieldV2> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoSeachActionSearchFieldRepository.findAllByIdIkoViewKeyAndIdIkoSeachActionKeyOrderBySearchFieldOrder(
            ikoViewKey,
            ikoSeachActionKey
        ).map { it.searchField }
    }

    fun deleteByKey(ikoViewKey: String, ikoSeachActionKey: String, searchFieldKey: String) {
        ikoViewService.denyAuthorization()
        ikoSeachActionSearchFieldRepository.deleteByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
            searchFieldKey = searchFieldKey
        )
    }

    fun deleteByIkoSeachActionKey(ikoViewKey: String, ikoSeachActionKey: String) {
        ikoViewService.denyAuthorization()
        ikoSeachActionSearchFieldRepository.deleteByIdIkoViewKeyAndIdIkoSeachActionKey(
            ikoViewKey = ikoViewKey,
            ikoSeachActionKey = ikoSeachActionKey,
        )
        ikoSeachActionSearchFieldRepository.flush()
    }

    fun create(ikoViewKey: String, ikoSeachActionKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoViewService.denyAuthorization()
        require(
            ikoSeachActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
                ikoViewKey,
                ikoSeachActionKey,
                searchField.key
            ) == null
        )
        val createdSearchField = runWithoutAuthorization {
            searchFieldService.create(SearchFieldV2Dto.of(searchField))
        }
        ikoSeachActionSearchFieldRepository.save(
            IkoSeachActionSearchField(
                id = IkoSeachActionSearchFieldId(
                    ikoSeachActionKey = ikoSeachActionKey,
                    ikoViewKey = ikoViewKey,
                    searchFieldId = searchField.id
                ),
                searchField = createdSearchField,
            )
        )
        return createdSearchField
    }

    fun update(ikoViewKey: String, ikoSeachActionKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoViewService.denyAuthorization()
        val ikoSeachActionSearchField =
            ikoSeachActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
                ikoViewKey,
                ikoSeachActionKey,
                searchField.key
            )
        requireNotNull(ikoSeachActionSearchField)
        val updatedSearchField = runWithoutAuthorization {
            searchFieldService.update(SearchFieldV2Dto.of(searchField.copy(id = ikoSeachActionSearchField.id.searchFieldId)))
        }
        ikoSeachActionSearchFieldRepository.save(
            ikoSeachActionSearchField.copy(
                searchField = updatedSearchField,
            )
        )
        return updatedSearchField
    }

}
