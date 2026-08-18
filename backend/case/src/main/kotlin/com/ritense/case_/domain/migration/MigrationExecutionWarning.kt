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
 * A case (by UUID) that migrated, but for which the plan did not do everything it describes, with
 * what was skipped and why (newline-separated when several components skipped something).
 *
 * Distinct from [MigrationExecutionError]: the case is on its target version and nothing rolled
 * back. A skip is a legitimate outcome — `addBuildingBlock` has nothing to hijack on a closed case —
 * but an operator reading "47 cases migrated" cannot tell that apart from a run that skipped every
 * building block it was asked to create, which is exactly the report a misconfigured plan produces.
 */
data class MigrationExecutionWarning(
    val caseId: String,
    val message: String?,
)
