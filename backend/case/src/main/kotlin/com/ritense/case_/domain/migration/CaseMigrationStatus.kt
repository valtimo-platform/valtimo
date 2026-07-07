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

enum class CaseMigrationStatus {
    /** No run has started yet. */
    NOT_STARTED,

    /** A run is executing right now (claimed by one node, lease-renewed); other triggers must not start it. */
    RUNNING,

    /** The run finished: every case matching the plan's conditions has been migrated. */
    COMPLETED,

    /** The run finished, but one or more matching cases failed and were rolled back. */
    COMPLETED_WITH_ERRORS;

    fun isFinished() = this == COMPLETED || this == COMPLETED_WITH_ERRORS
}
