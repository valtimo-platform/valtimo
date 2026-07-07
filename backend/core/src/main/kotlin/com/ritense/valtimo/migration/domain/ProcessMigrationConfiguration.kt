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

package com.ritense.valtimo.migration.domain

import com.ritense.valtimo.contract.case_.migration.CaseDefinitionMigrationId
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Type

/**
 * The `processMigration` component of a migration plan, owned by the `core` module. Stored
 * independently from the plan skeleton (owned by the `case` module) so component ownership stays
 * decoupled per module.
 */
@Entity
@Table(name = "case_definition_migration_process")
data class ProcessMigrationConfiguration(

    @EmbeddedId
    val id: CaseDefinitionMigrationId,

    @Type(JsonType::class)
    @Column(name = "instructions", nullable = false)
    val instructions: List<ProcessMigrationInstruction> = emptyList(),
)
