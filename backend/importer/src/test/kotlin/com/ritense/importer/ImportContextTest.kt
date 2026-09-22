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

package com.ritense.importer

import com.ritense.importer.ImportContext.Companion.claimOncePerRun
import com.ritense.importer.ImportContext.Companion.isImporting
import com.ritense.importer.ImportContext.Companion.runImporter
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ImportContextTest {

    @Test
    fun `should claim a key once per run`() {
        runImporter<Unit> {
            assertThat(claimOncePerRun("key")).isTrue()
            assertThat(claimOncePerRun("key")).isFalse()
            assertThat(claimOncePerRun("key")).isFalse()
        }
    }

    @Test
    fun `should claim different keys independently`() {
        runImporter<Unit> {
            assertThat(claimOncePerRun("key-1")).isTrue()
            assertThat(claimOncePerRun("key-2")).isTrue()
        }
    }

    @Test
    fun `should clear claims when the outermost run returns`() {
        runImporter<Unit> { claimOncePerRun("key") }

        runImporter<Unit> {
            assertThat(claimOncePerRun("key")).isTrue()
        }
    }

    @Test
    fun `should clear claims when the outermost run throws`() {
        assertThatThrownBy {
            runImporter<Unit> {
                claimOncePerRun("key")
                throw IllegalStateException("import failed")
            }
        }.isInstanceOf(IllegalStateException::class.java)

        runImporter<Unit> {
            assertThat(claimOncePerRun("key")).isTrue()
        }
    }

    @Test
    fun `should keep claims across a nested run`() {
        runImporter<Unit> {
            assertThat(claimOncePerRun("key")).isTrue()

            runImporter<Unit> {
                assertThat(claimOncePerRun("key")).isFalse()
            }

            assertThat(claimOncePerRun("key")).isFalse()
        }
    }

    @Test
    fun `should claim every time outside a run`() {
        assertThat(claimOncePerRun("key")).isTrue()
        assertThat(claimOncePerRun("key")).isTrue()
    }

    @Test
    fun `should not leak a claim made outside a run into the next run`() {
        claimOncePerRun("key")

        runImporter<Unit> {
            assertThat(claimOncePerRun("key")).isTrue()
        }
    }

    @Test
    fun `should report whether an import is running`() {
        assertThat(isImporting()).isFalse()

        runImporter<Unit> {
            assertThat(isImporting()).isTrue()
        }

        assertThat(isImporting()).isFalse()
    }
}
