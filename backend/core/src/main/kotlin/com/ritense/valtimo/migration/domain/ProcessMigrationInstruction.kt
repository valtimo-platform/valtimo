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

import com.fasterxml.jackson.annotation.JsonInclude

/** One `processMigration` instruction, translated 1:1 into an Operaton MigrationPlan. [setProcessVariables] is a GZAC-layer addition applied only when the plan's conditions hold. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ProcessMigrationInstruction(
    val sourceProcessDefinitionKey: String,
    val targetProcessDefinitionKey: String,
    val mapActivities: Map<String, String> = emptyMap(),
    val setProcessVariables: List<ProcessVariablePatch> = emptyList(),
    val skipCustomListeners: Boolean = false,
    val skipIoMappings: Boolean = false,
)
