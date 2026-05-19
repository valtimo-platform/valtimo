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

package com.ritense.document.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "internal_case_status_history")
data class InternalCaseStatusHistory(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "document_id", nullable = false)
    val documentId: UUID,

    @Column(name = "case_definition_key", nullable = false)
    val caseDefinitionKey: String,

    @Column(name = "internal_case_status_key", nullable = false)
    val internalCaseStatusKey: String,

    @Column(name = "created_on", nullable = false)
    val createdOn: LocalDateTime = LocalDateTime.now(),
)
