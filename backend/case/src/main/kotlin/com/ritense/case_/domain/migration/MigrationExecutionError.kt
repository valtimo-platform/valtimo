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

/**
 * A case (by UUID) whose migration failed and was rolled back, with the failure reason: the full
 * stacktrace of the exception that caused the rollback. Surfaced so operators can see which cases
 * errored and why (Theo's "overzicht van mislukte dossiers").
 */
data class MigrationExecutionError(
    val caseId: String,
    val message: String?,
)
