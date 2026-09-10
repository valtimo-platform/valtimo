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

package com.ritense.valtimo.contract.blueprint.migration

import com.ritense.valtimo.contract.BlueprintId
import java.util.UUID

/** Lets any module execute its component of a plan for one instance. Every executor runs in the caller's transaction, ordered by Spring `@Order`, so an instance that fails stays wholly on the old version. */
interface MigrationComponentExecutor {

    /** The plan component this executor runs; matches [MigrationComponentDeployer.componentKey]. */
    fun componentKey(): String

    /** Execute this component for [ownerDocumentId] against [target]. The instance is not necessarily a case — an executor that means "the case" must check `target.blueprintType()` itself. */
    fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID)
}
