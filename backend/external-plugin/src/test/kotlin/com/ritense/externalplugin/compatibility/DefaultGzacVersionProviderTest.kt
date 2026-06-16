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
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.info.BuildProperties
import java.util.Properties

class DefaultGzacVersionProviderTest {

    @Test
    fun `prefers the configured override over build properties`() {
        val provider = DefaultGzacVersionProvider(buildPropertiesProvider("13.1.3"), versionOverride = "9.9.9")

        assertThat(provider.getCurrentVersion()).isEqualTo("9.9.9")
    }

    @Test
    fun `falls back to build properties when no override is configured`() {
        val provider = DefaultGzacVersionProvider(buildPropertiesProvider("13.1.3"), versionOverride = "")

        assertThat(provider.getCurrentVersion()).isEqualTo("13.1.3")
    }

    @Test
    fun `ignores a blank override`() {
        val provider = DefaultGzacVersionProvider(buildPropertiesProvider("13.1.3"), versionOverride = "   ")

        assertThat(provider.getCurrentVersion()).isEqualTo("13.1.3")
    }

    @Test
    fun `returns null when neither override nor build properties resolve a version`() {
        val provider = DefaultGzacVersionProvider(emptyProvider(), versionOverride = null)

        assertThat(provider.getCurrentVersion()).isNull()
    }

    private fun buildPropertiesProvider(version: String): ObjectProvider<BuildProperties> {
        val buildProperties = BuildProperties(Properties().apply { setProperty("version", version) })
        return mock<ObjectProvider<BuildProperties>>().also {
            whenever(it.ifAvailable).thenReturn(buildProperties)
        }
    }

    private fun emptyProvider(): ObjectProvider<BuildProperties> =
        mock<ObjectProvider<BuildProperties>>().also {
            whenever(it.ifAvailable).thenReturn(null)
        }
}
