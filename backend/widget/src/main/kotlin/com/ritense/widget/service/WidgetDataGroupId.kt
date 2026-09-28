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

package com.ritense.widget.service

import com.ritense.valueresolver.ValueResolverCache
import com.ritense.valueresolver.ValueResolverDependencies
import io.github.oshai.kotlinlogging.KotlinLogging
import java.security.MessageDigest

/** Widgets that fetch nothing; answered together. */
const val NO_DATA_GROUP_ID = "static"

/**
 * @param dependencies the external contexts its values resolve against.
 * @param paged the client pages this widget and fetches it alone. Bundling it would do work nobody
 *        reads and delay its group peers.
 */
data class WidgetDataDependencies(
    val dependencies: ValueResolverDependencies,
    val paged: Boolean = false,
)

/**
 * Stable id for a dependency set; widgets sharing one can be served in a single request.
 *
 * Pure function — no hashCode, no randomness — so it survives restarts and matches across instances.
 * Holds only while every cache key has a value-based toString; see
 * [com.ritense.valueresolver.ValueResolverFactory.resolverCacheKey].
 */
fun dataGroupId(dependencies: Collection<Pair<String, Any>>): String {
    if (dependencies.isEmpty()) return NO_DATA_GROUP_ID

    return hashOf(dependencies.map { (prefix, key) -> "$prefix|$key" })
}

/**
 * Widget key to data group id. Determining dependencies needs config lookups, so the batch runs in
 * one cache scope.
 *
 * A widget stays on its own request unless bundling is provably safe — not paged, dependencies
 * determined, every factory declared an identity.
 */
fun dataGroupIds(
    widgetKeys: Collection<String>,
    dependenciesOf: (String) -> WidgetDataDependencies,
): Map<String, String> = ValueResolverCache.memoized {
    widgetKeys.associateWith { widgetKey ->
        val widgetDependencies = try {
            dependenciesOf(widgetKey)
        } catch (e: Exception) {
            logger.warn(e) {
                "Could not determine the data group of widget '$widgetKey'; it keeps a request of its own"
            }
            null
        }

        when {
            widgetDependencies == null -> ownGroupId(widgetKey)
            widgetDependencies.paged -> ownGroupId(widgetKey)
            widgetDependencies.dependencies.isEmpty -> NO_DATA_GROUP_ID
            !widgetDependencies.dependencies.isComplete -> ownGroupId(widgetKey)
            else -> dataGroupId(widgetDependencies.dependencies.keyed)
        }
    }
}

private fun ownGroupId(widgetKey: String) = hashOf(listOf("$UNGROUPED_PREFIX|$widgetKey"))

private fun hashOf(parts: Collection<String>): String =
    MessageDigest.getInstance("SHA-256")
        .digest(parts.sorted().joinToString(";").toByteArray())
        .take(GROUP_ID_BYTES)
        .joinToString("") { "%02x".format(it) }

private const val GROUP_ID_BYTES = 8
private const val UNGROUPED_PREFIX = "ungrouped-widget"
private val logger = KotlinLogging.logger {}
