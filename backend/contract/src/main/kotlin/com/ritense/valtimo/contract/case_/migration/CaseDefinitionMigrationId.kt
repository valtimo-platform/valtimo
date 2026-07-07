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

package com.ritense.valtimo.contract.case_.migration

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import java.io.Serializable

/**
 * Identifies a single migration plan.
 *
 * The [caseDefinitionId] is the *target* case definition version the plan migrates cases to
 * (implied by the folder the `*.migration.json` file lives in), and [migrationKey] is the
 * plan's own stable, unique key.
 *
 * This id lives in the contract module so that modules which are not linked to each other
 * (e.g. `case` owning `dataMigration`, `core` owning `processMigration`) can each key their
 * own part of the same migration plan.
 */
@Embeddable
data class CaseDefinitionMigrationId(

    @Embedded
    val caseDefinitionId: CaseDefinitionId,

    @Column(name = "migration_key", nullable = false)
    val migrationKey: String,
) : Serializable
