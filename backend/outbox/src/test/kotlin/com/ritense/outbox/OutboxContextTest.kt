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

package com.ritense.outbox

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class OutboxContextTest {

    @Test
    fun `should suppress outbox within block`() {
        assertThat(OutboxContext.outboxSuppressed).isFalse()

        OutboxContext.runWithSuppressedOutbox {
            assertThat(OutboxContext.outboxSuppressed).isTrue()
            "result"
        }

        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }

    @Test
    fun `should not suppress outbox when suppress is false`() {
        assertThat(OutboxContext.outboxSuppressed).isFalse()

        OutboxContext.runWithSuppressedOutbox(suppress = false) {
            assertThat(OutboxContext.outboxSuppressed).isFalse()
            "result"
        }

        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }

    @Test
    fun `should return callable result`() {
        val result = OutboxContext.runWithSuppressedOutbox { "hello" }
        assertThat(result).isEqualTo("hello")
    }

    @Test
    fun `should return callable result when suppress is false`() {
        val result = OutboxContext.runWithSuppressedOutbox(suppress = false) { "hello" }
        assertThat(result).isEqualTo("hello")
    }

    @Test
    fun `should remain suppressed in nested call and not reset prematurely`() {
        OutboxContext.runWithSuppressedOutbox {
            assertThat(OutboxContext.outboxSuppressed).isTrue()

            OutboxContext.runWithSuppressedOutbox {
                assertThat(OutboxContext.outboxSuppressed).isTrue()
                "inner"
            }

            // Should still be suppressed after inner block completes
            assertThat(OutboxContext.outboxSuppressed).isTrue()
            "outer"
        }

        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }

    @Test
    fun `should reset suppressed state even when callable throws`() {
        try {
            OutboxContext.runWithSuppressedOutbox {
                throw RuntimeException("test error")
            }
        } catch (_: RuntimeException) {
            // expected
        }

        assertThat(OutboxContext.outboxSuppressed).isFalse()
    }
}
