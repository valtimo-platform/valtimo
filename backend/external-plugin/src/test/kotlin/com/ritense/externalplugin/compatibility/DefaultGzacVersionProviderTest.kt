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

package com.ritense.externalplugin.compatibility

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class DefaultGzacVersionProviderTest {

    @Test
    fun `prefers the configured override over the library version`() {
        val provider = DefaultGzacVersionProvider(versionOverride = "9.9.9", libraryVersion = "13.5.0")

        assertThat(provider.getCurrentVersion()).isEqualTo("9.9.9")
    }

    @Test
    fun `falls back to the valtimo library version when no override is configured`() {
        val provider = DefaultGzacVersionProvider(versionOverride = "", libraryVersion = "13.5.0")

        assertThat(provider.getCurrentVersion()).isEqualTo("13.5.0")
    }

    @Test
    fun `ignores a blank override and a blank library version`() {
        val provider = DefaultGzacVersionProvider(versionOverride = "   ", libraryVersion = "  ")

        assertThat(provider.getCurrentVersion()).isNull()
    }

    @Test
    fun `returns null when nothing resolves a version`() {
        val provider = DefaultGzacVersionProvider(versionOverride = null, libraryVersion = null)

        assertThat(provider.getCurrentVersion()).isNull()
    }
}
