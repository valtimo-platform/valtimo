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

package com.ritense.processdocument.migration

import com.ritense.valtimo.contract.blueprint.migration.MigrationRunCache
import org.operaton.bpm.engine.RuntimeService

/** The subset of [activityMapping] a plan already calling `mapEqualActivities()` still has to add: an author's `id -> id` the engine has itself mapped is a duplicate instruction that fails the whole plan, so it is dropped — but one the equal mapping did *not* make is kept, since a same-id pair whose type changed is a real incompatibility (G11). */
fun RuntimeService.changedActivityMappings(
    sourceProcessDefinitionId: String,
    targetProcessDefinitionId: String,
    activityMapping: Map<String, String>,
): Map<String, String> {
    if (activityMapping.none { (source, target) -> source == target }) {
        return activityMapping
    }
    val equalMapped = equalMappedSourceActivityIds(sourceProcessDefinitionId, targetProcessDefinitionId)
    return activityMapping.filterNot { (source, target) -> source == target && source in equalMapped }
}

/** The source activities `mapEqualActivities()` maps on its own; empty when even that plan will not build, leaving every mapping in place so the failure reported is the engine's. Memoized for the run. */
private fun RuntimeService.equalMappedSourceActivityIds(
    sourceProcessDefinitionId: String,
    targetProcessDefinitionId: String,
): Set<String> = MigrationRunCache.computeIfAbsent(
    EqualMappedActivitiesKey(sourceProcessDefinitionId, targetProcessDefinitionId)
) {
    runCatching {
        createMigrationPlan(sourceProcessDefinitionId, targetProcessDefinitionId)
            .mapEqualActivities()
            .build()
            .instructions
            .mapNotNull { it.sourceActivityId }
            .toSet()
    }.getOrDefault(emptySet())
}

/** Private, so nothing else sharing [MigrationRunCache]'s keyspace can collide. */
private data class EqualMappedActivitiesKey(val sourceProcessDefinitionId: String, val targetProcessDefinitionId: String)
