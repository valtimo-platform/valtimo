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

package com.ritense.case.domain

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "case_definition_configuration_issue")
data class CaseDefinitionConfigurationIssue(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Embedded
    val caseDefinitionId: CaseDefinitionId,

    @Column(name = "issue_type", nullable = false)
    val issueType: String,

    @Column(name = "resolved", nullable = false)
    val resolved: Boolean = false,

    @Column(name = "created_at", nullable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "resolved_at")
    val resolvedAt: LocalDateTime? = null
)
