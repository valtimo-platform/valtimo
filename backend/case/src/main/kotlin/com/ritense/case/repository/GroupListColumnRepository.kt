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

package com.ritense.case.repository

import com.ritense.case.domain.group.GroupListColumn
import com.ritense.case.domain.group.GroupListColumnId
import org.springframework.data.jpa.repository.JpaRepository

interface GroupListColumnRepository : JpaRepository<GroupListColumn, GroupListColumnId> {
    fun findByIdGroupKeyOrderByOrderAsc(groupKey: String): List<GroupListColumn>
    fun deleteByIdGroupKeyAndIdColumnKey(groupKey: String, columnKey: String)
    fun deleteByIdGroupKey(groupKey: String)
    fun existsByIdGroupKeyAndIdColumnKey(groupKey: String, columnKey: String): Boolean
}
