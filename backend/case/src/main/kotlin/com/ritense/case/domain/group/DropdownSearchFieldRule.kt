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

package com.ritense.case.domain.group

import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType

object DropdownSearchFieldRule {

    fun isDropdown(fieldType: FieldType): Boolean =
        fieldType == FieldType.SINGLE_SELECT_DROPDOWN || fieldType == FieldType.MULTI_SELECT_DROPDOWN

    fun violation(
        key: String,
        dataType: DataType,
        fieldType: FieldType,
        dropdownDataProvider: String?,
        providerNames: Collection<String>
    ): String? = when {
        !isDropdown(fieldType) -> null
        dataType != DataType.TEXT -> "Dropdown search field '$key' must have data type text"
        dropdownDataProvider.isNullOrBlank() || dropdownDataProvider !in providerNames ->
            "Dropdown search field '$key' needs an existing dropdown data provider"
        else -> null
    }
}
