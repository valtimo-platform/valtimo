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
import com.ritense.iko.domain.IkoSearchActionSearchField
import com.ritense.iko.domain.IkoSearchActionSearchFieldId
import com.ritense.iko.repository.IkoSearchActionSearchFieldRepository
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
    private val ikoSearchActionSearchFieldRepository: IkoSearchActionSearchFieldRepository,
    private val ikoViewService: IkoViewService,
) {

    fun findByKey(ikoViewKey: String, ikoSearchActionKey: String, searchFieldKey: String): SearchFieldV2? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoSearchActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSearchActionKeyAndSearchFieldKey(
            ikoViewKey,
            ikoSearchActionKey,
            searchFieldKey
        )?.searchField
    }

    fun getByKey(ikoViewKey: String, ikoSearchActionKey: String, searchFieldKey: String): SearchFieldV2 {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return findByKey(ikoViewKey, ikoSearchActionKey, searchFieldKey)
            ?: error("Unknown searchField key: $searchFieldKey")
    }

    fun findAllSearchFieldsByIkoSearchAction(
        ikoViewKey: String,
        ikoSearchActionKey: String
    ): List<SearchFieldV2> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoSearchActionSearchFieldRepository.findAllByIdIkoViewKeyAndIdIkoSearchActionKeyOrderBySearchFieldOrder(
            ikoViewKey,
            ikoSearchActionKey
        ).map { it.searchField }
    }

    fun deleteByKey(ikoViewKey: String, ikoSearchActionKey: String, searchFieldKey: String) {
        ikoViewService.denyAuthorization()
        ikoSearchActionSearchFieldRepository.deleteByIdIkoViewKeyAndIdIkoSearchActionKeyAndSearchFieldKey(
            ikoViewKey = ikoViewKey,
            ikoSearchActionKey = ikoSearchActionKey,
            searchFieldKey = searchFieldKey
        )
    }

    fun deleteByIkoSearchActionKey(ikoViewKey: String, ikoSearchActionKey: String) {
        ikoViewService.denyAuthorization()
        ikoSearchActionSearchFieldRepository.deleteByIdIkoViewKeyAndIdIkoSearchActionKey(
            ikoViewKey = ikoViewKey,
            ikoSearchActionKey = ikoSearchActionKey,
        )
        ikoSearchActionSearchFieldRepository.flush()
    }

    fun create(ikoViewKey: String, ikoSearchActionKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoViewService.denyAuthorization()
        require(
            ikoSearchActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSearchActionKeyAndSearchFieldKey(
                ikoViewKey,
                ikoSearchActionKey,
                searchField.key
            ) == null
        )
        val createdSearchField = runWithoutAuthorization {
            searchFieldService.create(SearchFieldV2Dto.of(searchField))
        }
        ikoSearchActionSearchFieldRepository.save(
            IkoSearchActionSearchField(
                id = IkoSearchActionSearchFieldId(
                    ikoSearchActionKey = ikoSearchActionKey,
                    ikoViewKey = ikoViewKey,
                    searchFieldId = searchField.id
                ),
                searchField = createdSearchField,
            )
        )
        return createdSearchField
    }

    fun update(ikoViewKey: String, ikoSearchActionKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoViewService.denyAuthorization()
        val ikoSearchActionSearchField =
            ikoSearchActionSearchFieldRepository.findByIdIkoViewKeyAndIdIkoSearchActionKeyAndSearchFieldKey(
                ikoViewKey,
                ikoSearchActionKey,
                searchField.key
            )
        requireNotNull(ikoSearchActionSearchField)
        val updatedSearchField = runWithoutAuthorization {
            searchFieldService.update(SearchFieldV2Dto.of(searchField.copy(id = ikoSearchActionSearchField.id.searchFieldId)))
        }
        ikoSearchActionSearchFieldRepository.save(
            ikoSearchActionSearchField.copy(
                searchField = updatedSearchField,
            )
        )
        return updatedSearchField
    }

}
