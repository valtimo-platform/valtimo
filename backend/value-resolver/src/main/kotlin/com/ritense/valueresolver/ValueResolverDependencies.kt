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

package com.ritense.valueresolver

/**
 * @param keyed (prefix, [ValueResolverFactory.resolverCacheKey]) per factory that declared one.
 * @param unkeyedPrefixes prefixes whose factory declared none — may fetch, shareability unknown.
 */
data class ValueResolverDependencies(
    val keyed: Set<Pair<String, Any>>,
    val unkeyedPrefixes: Set<String>,
) {
    /** Nothing requested, so no fetch to share or to fear. */
    val isEmpty: Boolean get() = keyed.isEmpty() && unkeyedPrefixes.isEmpty()

    /** Every requested value's factory declared an identity. */
    val isComplete: Boolean get() = unkeyedPrefixes.isEmpty()

    companion object {
        val NONE = ValueResolverDependencies(emptySet(), emptySet())
    }
}
