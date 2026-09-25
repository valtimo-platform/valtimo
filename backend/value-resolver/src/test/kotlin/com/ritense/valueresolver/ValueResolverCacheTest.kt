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

import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Function

internal class ValueResolverCacheTest {

    private val factory = CountingValueResolverFactory()
    private val resolverService = ValueResolverServiceImpl(listOf(factory))

    @Test
    fun `should create one resolver for equal cache keys within a scope`() {
        ValueResolverCache.memoized {
            resolverService.resolveValues(mapOf("source" to "a", WIDGET_KEY to "first"), listOf("counting:x"))
            resolverService.resolveValues(mapOf("source" to "a", WIDGET_KEY to "second"), listOf("counting:y"))
        }

        assertThat(factory.created.get()).isEqualTo(1)
    }

    @Test
    fun `should create separate resolvers for differing cache keys within a scope`() {
        ValueResolverCache.memoized {
            resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))
            resolverService.resolveValues(mapOf("source" to "b"), listOf("counting:x"))
        }

        assertThat(factory.created.get()).isEqualTo(2)
    }

    @Test
    fun `should create a fresh resolver per call outside a scope`() {
        resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))
        resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:y"))

        assertThat(factory.created.get()).isEqualTo(2)
    }

    @Test
    fun `should not compute the cache key outside a scope`() {
        resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))

        assertThat(factory.keysComputed.get()).isZero()
    }

    @Test
    fun `should not cache when the factory returns no cache key`() {
        ValueResolverCache.memoized {
            resolverService.resolveValues(emptyMap(), listOf("counting:x"))
            resolverService.resolveValues(emptyMap(), listOf("counting:y"))
        }

        assertThat(factory.created.get()).isEqualTo(2)
    }

    @Test
    fun `should isolate scopes from each other`() {
        ValueResolverCache.memoized {
            resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))
        }
        ValueResolverCache.memoized {
            resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))
        }

        assertThat(factory.created.get()).isEqualTo(2)
    }

    @Test
    fun `should join an outer scope when nested`() {
        ValueResolverCache.memoized {
            resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:x"))
            ValueResolverCache.memoized {
                resolverService.resolveValues(mapOf("source" to "a"), listOf("counting:y"))
            }
            assertThat(ValueResolverCache.isActive()).isTrue()
        }

        assertThat(factory.created.get()).isEqualTo(1)
    }

    @Test
    fun `should clear the scope after memoized returns`() {
        ValueResolverCache.memoized { assertThat(ValueResolverCache.isActive()).isTrue() }

        assertThat(ValueResolverCache.isActive()).isFalse()
    }

    @Test
    fun `should clear the scope when memoized throws`() {
        assertThrows<IllegalStateException> {
            ValueResolverCache.memoized { error("boom") }
        }

        assertThat(ValueResolverCache.isActive()).isFalse()
    }

    @Test
    fun `should memoize values within a scope only`() {
        val computed = AtomicInteger()

        ValueResolverCache.memoized {
            ValueResolverCache.value("ns", "key") { computed.incrementAndGet() }
            ValueResolverCache.value("ns", "key") { computed.incrementAndGet() }
        }
        ValueResolverCache.value("ns", "key") { computed.incrementAndGet() }

        assertThat(computed.get()).isEqualTo(2)
    }

    @Test
    fun `should memoize a null value`() {
        val computed = AtomicInteger()

        ValueResolverCache.memoized {
            ValueResolverCache.value<String?>("ns", "key") { computed.incrementAndGet(); null }
            ValueResolverCache.value<String?>("ns", "key") { computed.incrementAndGet(); null }
        }

        assertThat(computed.get()).isEqualTo(1)
    }

    @Test
    fun `should report the dependencies of requested values`() {
        val dependencies = resolverService.resolverDependencies(
            mapOf("source" to "a"),
            listOf("counting:x", "counting:y")
        )

        assertThat(dependencies.keyed).containsExactly("counting" to "a")
        assertThat(dependencies.isComplete).isTrue()
    }

    @Test
    fun `should report an unkeyed prefix when the factory declares no cache key`() {
        val dependencies = resolverService.resolverDependencies(emptyMap(), listOf("counting:x"))

        assertThat(dependencies.keyed).isEmpty()
        assertThat(dependencies.unkeyedPrefixes).containsExactly("counting")
        assertThat(dependencies.isComplete).isFalse()
        assertThat(dependencies.isEmpty).isFalse()
    }

    @Test
    fun `should report nothing at all when no values are requested`() {
        val dependencies = resolverService.resolverDependencies(mapOf("source" to "a"), emptyList())

        assertThat(dependencies.isEmpty).isTrue()
        assertThat(dependencies.isComplete).isTrue()
    }

    private class CountingValueResolverFactory : ValueResolverFactory {
        val created = AtomicInteger()
        val keysComputed = AtomicInteger()

        override fun supportedPrefix() = "counting"

        override fun resolverCacheKey(properties: Map<String, Any>): Any? {
            keysComputed.incrementAndGet()
            return properties["source"]
        }

        override fun createResolver(properties: Map<String, Any>): Function<String, Any?> {
            created.incrementAndGet()
            return Function { requestedValue -> "$requestedValue@${properties["source"]}" }
        }
    }
}
