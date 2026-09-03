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
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.Table

@Entity
@Table(name = "case_definition_group_member")
data class CaseDefinitionGroupMember(

    @EmbeddedId
    val id: CaseDefinitionGroupMemberId,

    @ManyToOne(fetch = LAZY)
    @MapsId("groupKey")
    @JoinColumn(name = "group_key", insertable = false, updatable = false)
    val group: CaseDefinitionGroup? = null,

    @Column(name = "sort_order", nullable = false)
    val order: Int

) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is CaseDefinitionGroupMember) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
