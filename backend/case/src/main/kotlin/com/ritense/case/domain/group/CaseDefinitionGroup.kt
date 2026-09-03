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

import com.ritense.valtimo.contract.utils.SecurityUtils
import jakarta.persistence.CascadeType.ALL
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType.LAZY
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.ZonedDateTime

@Entity
@Table(name = "case_definition_group")
data class CaseDefinitionGroup(

    @Id
    @Column(name = "`key`", updatable = false, nullable = false, unique = true)
    val key: String,

    @Column(name = "title", nullable = false)
    val title: String,

    @Column(name = "description")
    val description: String? = null,

    @Column(name = "sort_order", nullable = false)
    val order: Int,

    @OneToMany(mappedBy = "group", fetch = LAZY, cascade = [ALL], orphanRemoval = true)
    @OrderBy("order ASC")
    val members: MutableList<CaseDefinitionGroupMember> = mutableListOf(),

    @OneToMany(mappedBy = "group", fetch = LAZY, cascade = [ALL], orphanRemoval = true)
    @OrderBy("order ASC")
    val listColumns: MutableList<GroupListColumn> = mutableListOf(),

    @OneToMany(mappedBy = "group", fetch = LAZY, cascade = [ALL], orphanRemoval = true)
    @OrderBy("order ASC")
    val searchFields: MutableList<GroupSearchField> = mutableListOf(),

    @Column(name = "created_by")
    val createdBy: String = SecurityUtils.getCurrentUserLogin() ?: "system",

    @Column(name = "created_on")
    val createdOn: ZonedDateTime = ZonedDateTime.now()

) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CaseDefinitionGroup) return false
        return key == other.key
    }

    override fun hashCode(): Int = key.hashCode()
}
