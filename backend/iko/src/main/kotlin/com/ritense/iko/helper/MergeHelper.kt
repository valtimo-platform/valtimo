/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.helper

object MergeHelper {

    /**
     * Recursively merges this map with another map.
     *
     * @param other the map whose entries should be merged into this map.
     * @return a new map containing the merged contents of both maps.
     */
    fun <K : Any?, V : Any?> Map<K, V>.deepMerge(other: Map<K, V>): Map<K, V> {
        @Suppress("UNCHECKED_CAST") return toMutableMap().apply {
            other.forEach { (key, value) ->
                this[key] = deepMerge(this[key], value) as V
            }
        }
    }

    private fun deepMerge(left: Any?, right: Any?): Any? = when {
        left == null -> right
        right == null -> left
        left is Map<*, *> && right is Map<*, *> -> deepMergeMap(left, right)
        left is List<*> && right is List<*> -> left + right
        left is Set<*> && right is Set<*> -> left union right
        else -> right
    }

    private fun deepMergeMap(left: Map<*, *>, right: Map<*, *>): Map<*, *> {
        return left.toMutableMap().apply {
            right.forEach { (key, value) ->
                this[key] = deepMerge(this[key], value)
            }
        }
    }

}
