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
import com.ritense.iko.authorization.IkoDataAggregateActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoDataRequestSearchField
import com.ritense.iko.domain.IkoDataRequestSearchFieldId
import com.ritense.iko.repository.IkoDataRequestSearchFieldRepository
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
    private val ikoDataRequestSearchFieldRepository: IkoDataRequestSearchFieldRepository,
    private val ikoDataAggregateService: IkoDataAggregateService,
) {

    fun findByKey(ikoDataAggregateKey: String, ikoDataRequestKey: String, searchFieldKey: String): SearchFieldV2? {
        ikoDataAggregateService.requirePermission(ikoDataAggregateKey, VIEW)
        return ikoDataRequestSearchFieldRepository.findByIdIkoDataAggregateKeyAndIdIkoDataRequestKeyAndSearchFieldKey(
            ikoDataAggregateKey,
            ikoDataRequestKey,
            searchFieldKey
        )?.searchField
    }

    fun getByKey(ikoDataAggregateKey: String, ikoDataRequestKey: String, searchFieldKey: String): SearchFieldV2 {
        ikoDataAggregateService.requirePermission(ikoDataAggregateKey, VIEW)
        return findByKey(ikoDataAggregateKey, ikoDataRequestKey, searchFieldKey)
            ?: error("Unknown searchField key: $searchFieldKey")
    }

    fun findAllSearchFieldsByIkoDataRequest(
        ikoDataAggregateKey: String,
        ikoDataRequestKey: String
    ): List<SearchFieldV2> {
        ikoDataAggregateService.requirePermission(ikoDataAggregateKey, VIEW)
        return ikoDataRequestSearchFieldRepository.findAllByIdIkoDataAggregateKeyAndIdIkoDataRequestKeyOrderBySearchFieldOrder(
            ikoDataAggregateKey,
            ikoDataRequestKey
        ).map { it.searchField }
    }

    fun deleteByKey(ikoDataAggregateKey: String, ikoDataRequestKey: String, searchFieldKey: String) {
        ikoDataAggregateService.denyAuthorization()
        ikoDataRequestSearchFieldRepository.deleteByIdIkoDataAggregateKeyAndIdIkoDataRequestKeyAndSearchFieldKey(
            ikoDataAggregateKey = ikoDataAggregateKey,
            ikoDataRequestKey = ikoDataRequestKey,
            searchFieldKey = searchFieldKey
        )
    }

    fun deleteByIkoDataRequestKey(ikoDataAggregateKey: String, ikoDataRequestKey: String) {
        ikoDataAggregateService.denyAuthorization()
        ikoDataRequestSearchFieldRepository.deleteByIdIkoDataAggregateKeyAndIdIkoDataRequestKey(
            ikoDataAggregateKey = ikoDataAggregateKey,
            ikoDataRequestKey = ikoDataRequestKey,
        )
        ikoDataRequestSearchFieldRepository.flush()
    }

    fun create(ikoDataAggregateKey: String, ikoDataRequestKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoDataAggregateService.denyAuthorization()
        require(
            ikoDataRequestSearchFieldRepository.findByIdIkoDataAggregateKeyAndIdIkoDataRequestKeyAndSearchFieldKey(
                ikoDataAggregateKey,
                ikoDataRequestKey,
                searchField.key
            ) == null
        )
        val createdSearchField = runWithoutAuthorization {
            searchFieldService.create(SearchFieldV2Dto.of(searchField))
        }
        ikoDataRequestSearchFieldRepository.save(
            IkoDataRequestSearchField(
                id = IkoDataRequestSearchFieldId(
                    ikoDataRequestKey = ikoDataRequestKey,
                    ikoDataAggregateKey = ikoDataAggregateKey,
                    searchFieldId = searchField.id
                ),
                searchField = createdSearchField,
            )
        )
        return createdSearchField
    }

    fun update(ikoDataAggregateKey: String, ikoDataRequestKey: String, searchField: SearchFieldV2): SearchFieldV2 {
        ikoDataAggregateService.denyAuthorization()
        val ikoDataRequestSearchField =
            ikoDataRequestSearchFieldRepository.findByIdIkoDataAggregateKeyAndIdIkoDataRequestKeyAndSearchFieldKey(
                ikoDataAggregateKey,
                ikoDataRequestKey,
                searchField.key
            )
        requireNotNull(ikoDataRequestSearchField)
        val updatedSearchField = runWithoutAuthorization {
            searchFieldService.update(SearchFieldV2Dto.of(searchField.copy(id = ikoDataRequestSearchField.id.searchFieldId)))
        }
        ikoDataRequestSearchFieldRepository.save(
            ikoDataRequestSearchField.copy(
                searchField = updatedSearchField,
            )
        )
        return updatedSearchField
    }

}
