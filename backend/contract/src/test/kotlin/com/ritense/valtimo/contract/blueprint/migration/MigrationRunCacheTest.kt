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

import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class MigrationRunCacheTest {

    private val computations = AtomicInteger()

    private fun compute(value: String = "tree") = MigrationRunCache.computeIfAbsent("key") {
        computations.incrementAndGet()
        value
    }

    @Test
    fun `should compute once per key inside a run`() {
        MigrationRunCache.inRun {
            repeat(5) { compute() }
        }

        assertThat(computations.get()).isEqualTo(1)
    }

    /**
     * The transparency guarantee the resolver relies on: nothing outside a run — the plan editor, the
     * suggester, a single save — changes behaviour or value lifetime by this class existing.
     */
    @Test
    fun `should compute every time outside a run`() {
        repeat(5) { compute() }

        assertThat(computations.get()).isEqualTo(5)
    }

    @Test
    fun `should keep keys apart`() {
        MigrationRunCache.inRun {
            val a = MigrationRunCache.computeIfAbsent("a") { "first" }
            val b = MigrationRunCache.computeIfAbsent("b") { "second" }

            assertThat(a).isEqualTo("first")
            assertThat(b).isEqualTo("second")
        }
    }

    @Test
    fun `should not carry a value from one run into the next`() {
        MigrationRunCache.inRun { compute("first") }
        val second = MigrationRunCache.inRun { compute("second") }

        assertThat(second).isEqualTo("second")
        assertThat(computations.get()).isEqualTo(2)
    }

    /**
     * The leak that matters: a run executes on a pooled request thread, so a cache left behind would be
     * served to an unrelated later request on that same thread.
     */
    @Test
    fun `should close the scope when the run throws`() {
        assertThrows<IllegalStateException> {
            MigrationRunCache.inRun {
                compute()
                error("a case failed")
            }
        }

        assertThat(MigrationRunCache.isInRun()).isFalse()
        compute() // recomputed, because the cache went with the failed run
        assertThat(computations.get()).isEqualTo(2)
    }

    @Test
    fun `should let an inner scope share the outer cache without closing it`() {
        MigrationRunCache.inRun {
            compute()
            MigrationRunCache.inRun { compute() }

            assertThat(MigrationRunCache.isInRun()).isTrue()
            compute()
        }

        assertThat(computations.get()).isEqualTo(1)
        assertThat(MigrationRunCache.isInRun()).isFalse()
    }

    /** Thread-confined, which is what makes an unsynchronised HashMap the right structure. */
    @Test
    fun `should not share a cache between threads`() {
        val executor = Executors.newSingleThreadExecutor()
        try {
            MigrationRunCache.inRun {
                compute()
                val otherThreadSawRun = executor.submit<Boolean> { MigrationRunCache.isInRun() }
                assertThat(otherThreadSawRun.get(5, TimeUnit.SECONDS)).isFalse()
                // ...and the other thread computes its own value rather than reading this run's.
                executor.submit { compute() }.get(5, TimeUnit.SECONDS)
            }
        } finally {
            executor.shutdownNow()
        }

        assertThat(computations.get()).isEqualTo(2)
    }
}
