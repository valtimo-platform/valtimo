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

import com.ritense.iko.authorization.IkoViewActionProvider.Companion.VIEW
import com.ritense.iko.domain.IkoViewListColumn
import com.ritense.iko.domain.IkoViewListColumnId
import com.ritense.iko.repository.IkoViewListColumnRepository
import com.ritense.search.domain.SearchListColumn
import com.ritense.search.service.SearchListColumnService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@SkipComponentScan
@Service
class IkoListColumnService(
    private val listColumnService: SearchListColumnService,
    private val ikoViewListColumnRepository: IkoViewListColumnRepository,
    private val ikoViewService: IkoViewService,
) {

    fun findByKey(ikoViewKey: String, columnKey: String): SearchListColumn? {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoViewListColumnRepository.findByIdIkoViewKeyAndColumnKey(
            ikoViewKey,
            columnKey
        )?.column
    }

    fun getByKey(ikoViewKey: String, columnKey: String): SearchListColumn {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return findByKey(ikoViewKey, columnKey)
            ?: error("Unknown column key: $columnKey")
    }

    fun findAllColumnsByIkoViewKey(ikoViewKey: String): List<SearchListColumn> {
        ikoViewService.requirePermission(ikoViewKey, VIEW)
        return ikoViewListColumnRepository.findAllByIdIkoViewKeyOrderByColumnOrder(ikoViewKey)
            .map { it.column }
    }

    fun deleteByKey(ikoViewKey: String, columnKey: String) {
        ikoViewService.denyAuthorization()
        ikoViewListColumnRepository.deleteByIdIkoViewKeyAndColumnKey(
            ikoViewKey,
            columnKey
        )
    }

    fun deleteByIkoViewKey(ikoViewKey: String) {
        ikoViewService.denyAuthorization()
        ikoViewListColumnRepository.deleteByIdIkoViewKey(ikoViewKey)
    }

    fun create(ikoViewKey: String, listColumn: SearchListColumn): SearchListColumn {
        ikoViewService.denyAuthorization()
        require(
            ikoViewListColumnRepository.findByIdIkoViewKeyAndColumnKey(
                ikoViewKey,
                listColumn.key
            ) == null
        )
        if (listColumn.defaultSort != null) {
            unsetDefaultSort(ikoViewKey)
        }
        val createdColumn = listColumnService.create(listColumn)
        ikoViewListColumnRepository.save(
            IkoViewListColumn(
                id = IkoViewListColumnId(ikoViewKey, listColumn.id),
                column = createdColumn,
            )
        )
        return createdColumn
    }

    fun update(ikoViewKey: String, listColumn: SearchListColumn): SearchListColumn {
        ikoViewService.denyAuthorization()
        val ikoViewColumn =
            ikoViewListColumnRepository.findByIdIkoViewKeyAndColumnKey(
                ikoViewKey,
                listColumn.key
            )
        requireNotNull(ikoViewColumn)
        if (listColumn.defaultSort != null && ikoViewColumn.column.defaultSort == null) {
            unsetDefaultSort(ikoViewKey)
        }
        val updatedColumn =
            listColumnService.update(listColumn.copy(id = ikoViewColumn.id.listColumnId))
        ikoViewListColumnRepository.save(
            IkoViewListColumn(
                id = IkoViewListColumnId(ikoViewKey, updatedColumn.id),
                column = updatedColumn,
            )
        )
        return updatedColumn
    }

    private fun unsetDefaultSort(ikoViewKey: String) {
        findAllColumnsByIkoViewKey(ikoViewKey)
            .filter { listColumn -> listColumn.defaultSort != null }
            .forEach { listColumn -> listColumnService.update(listColumn.copy(defaultSort = null)) }
    }

}
