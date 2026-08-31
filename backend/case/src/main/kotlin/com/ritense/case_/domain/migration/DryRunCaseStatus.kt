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

/** Per-case outcome of a dry run. Kept apart from [CaseMigrationCaseStatus] so a dry run never influences whether a real run migrates or skips a case. */
enum class DryRunCaseStatus {
    /** The case would be migrated successfully (the simulated migration completed, then rolled back). */
    WOULD_MIGRATE,

    /** The case would fail (the simulation threw, or its conditions could not be evaluated). */
    WOULD_FAIL,
}
