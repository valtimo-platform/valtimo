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

package com.ritense.iko.repository

import com.ritense.iko.domain.IkoSeachActionSearchField
import com.ritense.iko.domain.IkoSeachActionSearchFieldId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.stereotype.Repository

@Repository
interface IkoSeachActionSearchFieldRepository :
    JpaRepository<IkoSeachActionSearchField, IkoSeachActionSearchFieldId>,
    JpaSpecificationExecutor<IkoSeachActionSearchField> {
    fun findAllByIdIkoViewKeyAndIdIkoSeachActionKeyOrderBySearchFieldOrder(
        ikoViewKey: String,
        ikoSeachActionKey: String
    ): List<IkoSeachActionSearchField>

    fun findByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
        ikoViewKey: String,
        ikoSeachActionKey: String,
        searchFieldKey: String
    ): IkoSeachActionSearchField?

    fun deleteByIdIkoViewKeyAndIdIkoSeachActionKeyAndSearchFieldKey(
        ikoViewKey: String,
        ikoSeachActionKey: String,
        searchFieldKey: String
    )

    fun deleteByIdIkoViewKeyAndIdIkoSeachActionKey(ikoViewKey: String, ikoSeachActionKey: String)
}
