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
import com.ritense.search.domain.SearchFieldMatchType
import jakarta.persistence.CascadeType.ALL
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType.LAZY
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "group_search_field")
data class GroupSearchField(

    @Id
    @Column(name = "id", updatable = false, nullable = false)
    val id: UUID = UUID.randomUUID(),

    @Column(name = "group_key", nullable = false)
    val groupKey: String,

    @ManyToOne(fetch = LAZY)
    @JoinColumn(name = "group_key", insertable = false, updatable = false)
    val group: CaseDefinitionGroup? = null,

    @Column(name = "field_key", nullable = false)
    val key: String,

    @Column(name = "title")
    val title: String?,

    @Column(name = "data_type", nullable = false)
    @Enumerated(EnumType.STRING)
    val dataType: DataType,

    @Column(name = "field_type", nullable = false)
    @Enumerated(EnumType.STRING)
    val fieldType: FieldType,

    @Column(name = "match_type")
    @Enumerated(EnumType.STRING)
    val matchType: SearchFieldMatchType?,

    @Column(name = "dropdown_data_provider")
    val dropdownDataProvider: String?,

    @Column(name = "field_order", nullable = false)
    val order: Int,

    @OneToMany(mappedBy = "searchField", fetch = LAZY, cascade = [ALL], orphanRemoval = true)
    val pathMappings: MutableList<GroupSearchFieldPathMapping> = mutableListOf()

) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is GroupSearchField) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
