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

package com.ritense.case_.domain.migration

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.LocalDateTime

/**
 * Describes when a migration plan is allowed to run.
 *
 * @param triggeredByButton the plan can be run manually from the UI button.
 * @param scheduledAtDate the plan runs automatically at (or after) this moment.
 * @param runAfter the [CaseDefinitionMigration] key this plan should be ordered after.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class MigrationTriggers(
    val triggeredByButton: Boolean = false,
    val scheduledAtDate: LocalDateTime? = null,
    val runAfter: String? = null,
)
