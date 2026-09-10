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

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory

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

    @Test
    fun `warns once, naming the override property, when no version resolves`() {
        val provider = DefaultGzacVersionProvider(versionOverride = null, libraryVersion = null)

        val warnings = captureWarnings { repeat(3) { provider.getCurrentVersion() } }

        assertThat(warnings).hasSize(1)
        assertThat(warnings.single()).contains("valtimo.external-plugin.gzac-version")
    }

    @Test
    fun `warns when the resolved version is not semver`() {
        val provider = DefaultGzacVersionProvider(versionOverride = "13-SNAPSHOT-local", libraryVersion = null)

        val warnings = captureWarnings { provider.getCurrentVersion() }

        assertThat(warnings).hasSize(1)
    }

    @Test
    fun `does not warn for a semver version`() {
        val provider = DefaultGzacVersionProvider(versionOverride = null, libraryVersion = "13.1.3")

        assertThat(captureWarnings { provider.getCurrentVersion() }).isEmpty()
    }

    private fun captureWarnings(block: () -> Unit): List<String> {
        val targetLogger = LoggerFactory.getLogger(DefaultGzacVersionProvider::class.java) as Logger
        val appender = ListAppender<ILoggingEvent>().apply { start() }
        targetLogger.addAppender(appender)
        try {
            block()
        } finally {
            targetLogger.detachAppender(appender)
            appender.stop()
        }
        return appender.list.filter { it.level == Level.WARN }.map { it.formattedMessage }
    }
}
