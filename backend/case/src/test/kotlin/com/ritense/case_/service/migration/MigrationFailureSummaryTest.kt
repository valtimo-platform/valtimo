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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.io.PrintWriter
import java.io.StringWriter

class MigrationFailureSummaryTest {

    @Test
    fun `should show the root cause when it has a message`() {
        val error = IllegalStateException("Migration failed", IllegalArgumentException("#: required key [naam] not found"))

        assertThat(MigrationFailureSummary.of(trace(error)))
            .isEqualTo("java.lang.IllegalArgumentException: #: required key [naam] not found")
    }

    @Test
    fun `should skip a root cause without a message for the deepest wrapper that has one`() {
        val error = RuntimeException(
            "Migration failed",
            IllegalStateException("Building block 'x' could not be handed back", NullPointerException()),
        )

        assertThat(MigrationFailureSummary.of(trace(error)))
            .isEqualTo("java.lang.IllegalStateException: Building block 'x' could not be handed back")
    }

    @Test
    fun `should fall back to the root cause when nothing in the chain has a message`() {
        val error = IllegalStateException(null as String?, NullPointerException())

        assertThat(MigrationFailureSummary.of(trace(error))).isEqualTo("java.lang.NullPointerException")
    }

    @Test
    fun `should ignore the causes of a suppressed exception`() {
        val error = IllegalStateException("Migration failed")
        error.addSuppressed(RuntimeException("cleanup", IllegalArgumentException("unrelated")))

        assertThat(MigrationFailureSummary.of(trace(error))).isEqualTo("java.lang.IllegalStateException: Migration failed")
    }

    @Test
    fun `should summarise nothing for a blank trace`() {
        assertThat(MigrationFailureSummary.of(" ")).isNull()
    }

    private fun trace(error: Throwable) = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
}
