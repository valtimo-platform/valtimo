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

import java.util.function.Function

/**
 * Thread-bound scope where resolvers with an equal [ValueResolverFactory.resolverCacheKey] are
 * created once, so the fetch happens once.
 *
 * Opt-in, not request-scoped: BPMN may read a value, write it and read it again, where memoizing
 * would serve a stale read.
 *
 * **One principal per scope.** [value] memoizes lookups whose bodies check permissions, so the check
 * runs on the first hit only. A scope spanning two users would reuse the first one's decision.
 */
object ValueResolverCache {

    private val resolvers = ThreadLocal<MutableMap<Any, Function<String, Any?>>>()
    private val values = ThreadLocal<MutableMap<Any, Holder>>()

    private class Holder(val value: Any?)

    /** Runs [block] in a scope. Re-entrant; cleared when the outermost call returns, also on throw. */
    fun <T> memoized(block: () -> T): T {
        val owner = resolvers.get() == null
        if (owner) {
            resolvers.set(mutableMapOf())
            values.set(mutableMapOf())
        }
        return try {
            block()
        } finally {
            if (owner) {
                resolvers.remove()
                values.remove()
            }
        }
    }

    fun isActive(): Boolean = resolvers.get() != null

    /** Memoizes a value on ([namespace], [key]). Outside a scope [create] runs every time. */
    @Suppress("UNCHECKED_CAST")
    fun <T> value(namespace: String, key: Any, create: () -> T): T {
        val scope = values.get() ?: return create()
        return scope.getOrPut(namespace to key) { Holder(create()) }.value as T
    }

    internal fun resolver(
        prefix: String,
        key: Any,
        create: () -> Function<String, Any?>,
    ): Function<String, Any?> = resolvers.get()?.getOrPut(prefix to key, create) ?: create()
}
