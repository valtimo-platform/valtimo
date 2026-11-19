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

import com.ritense.case.domain.ColumnDefaultSort
import com.ritense.search.domain.DisplayType
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.CascadeType.ALL
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType.LAZY
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import org.hibernate.annotations.Type

@Entity
@Table(name = "group_list_column")
data class GroupListColumn(

    @EmbeddedId
    val id: GroupListColumnId,

    @ManyToOne(fetch = LAZY)
    @MapsId("groupKey")
    @JoinColumn(name = "group_key", insertable = false, updatable = false)
    val group: CaseDefinitionGroup? = null,

    @Column(name = "title")
    val title: String?,

    @Type(value = JsonType::class)
    @Column(name = "display_type", columnDefinition = "JSON")
    val displayType: DisplayType,

    @Column(name = "sortable")
    val sortable: Boolean,

    @Column(name = "default_sort")
    @Enumerated(EnumType.STRING)
    val defaultSort: ColumnDefaultSort?,

    @Column(name = "column_order")
    val order: Int,

    @Column(name = "exportable")
    val exportable: Boolean,

    @OneToMany(mappedBy = "column", fetch = LAZY, cascade = [ALL], orphanRemoval = true)
    val pathMappings: MutableList<GroupListColumnPathMapping> = mutableListOf()

) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is GroupListColumn) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
