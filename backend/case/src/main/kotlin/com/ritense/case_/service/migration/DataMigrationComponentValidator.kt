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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator
import com.ritense.valueresolver.ValueResolverFactory

/** Validates the top-level `dataMigration` on save. The copies nested in a building-block entry are checked by that entry's own validator, through the same [DataMigrationPatchChecker]. */
class DataMigrationComponentValidator(
    private val valueResolverFactories: List<ValueResolverFactory>,
) : MigrationComponentValidator {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> =
        DataMigrationPatchChecker.findProblems(component, knownPrefixes(valueResolverFactories))

    companion object {
        /** The prefixes this deployment's resolvers answer to — what a `target` may start with. */
        fun knownPrefixes(factories: List<ValueResolverFactory>): List<String> =
            factories.map { it.supportedPrefix() }.filter { it.isNotBlank() }
    }
}
