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

package com.ritense.case_.service.migration

/**
 * Thrown when the running node discovers it no longer owns a migration plan (its fencing token no
 * longer matches, or a concurrent modification lost the optimistic lock) — another node has taken
 * the plan over. The run stops cleanly without recording spurious errors; the new owner continues.
 */
class MigrationOwnershipLostException(message: String) : RuntimeException(message)
