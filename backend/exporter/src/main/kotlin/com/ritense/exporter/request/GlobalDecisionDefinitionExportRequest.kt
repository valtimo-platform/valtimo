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

package com.ritense.exporter.request

/**
 * Export request for a decision definition that is not linked to a case definition or building block.
 * Exports into the `config/global` folder structure, so it can be imported on another environment
 * without a case definition being involved.
 */
data class GlobalDecisionDefinitionExportRequest(
    val decisionDefinitionId: String,
    override val required: Boolean = true,
) : ExportRequest(required)
