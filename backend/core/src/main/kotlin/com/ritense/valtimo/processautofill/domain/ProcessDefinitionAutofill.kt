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

package com.ritense.valtimo.processautofill.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "process_definition_autofill")
data class ProcessDefinitionAutofill(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "process_definition_id", nullable = false, length = 64)
    val processDefinitionId: String,

    @Column(name = "activity_id", nullable = false, length = 255)
    val activityId: String,

    @Column(name = "modification_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    val modificationType: AutofillModificationType,

    @Column(name = "applied_value", nullable = false, columnDefinition = "text")
    val appliedValue: String
)
