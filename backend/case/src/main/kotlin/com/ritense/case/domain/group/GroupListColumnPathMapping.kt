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

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType.LAZY
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinColumns
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "group_list_column_path_mapping")
data class GroupListColumnPathMapping(

    @EmbeddedId
    val id: GroupListColumnPathMappingId,

    @ManyToOne(fetch = LAZY)
    @JoinColumns(
        JoinColumn(name = "group_key", referencedColumnName = "group_key", insertable = false, updatable = false),
        JoinColumn(name = "column_key", referencedColumnName = "column_key", insertable = false, updatable = false)
    )
    val column: GroupListColumn? = null,

    @Column(name = "path", nullable = false)
    val path: String

) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is GroupListColumnPathMapping) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
