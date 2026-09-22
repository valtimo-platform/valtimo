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

package com.ritense.valtimo.contract.annotation

import com.ritense.valtimo.contract.custom.TestAnnotation
import com.whitelisted.WhitelistedClassWithTextAnnotation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.core.env.MapPropertySource

class AnnotationScannerTest {

    private lateinit var context: AnnotationConfigApplicationContext

    private lateinit var scanner: CountingAnnotationScanner

    @BeforeEach
    fun before() {
        context = AnnotationConfigApplicationContext()
        context.refresh()
        scanner = CountingAnnotationScanner(context)
    }

    @AfterEach
    fun after() {
        scanner.close()
        context.close()
    }

    @Test
    fun `should scan once for repeated calls with the same packages`() {
        val first = scanner.getScanResult(ACCEPT_PACKAGES)
        val second = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanner.scanCount).isEqualTo(1)
        assertThat(second).isSameAs(first)
        assertThat(first.getClassesWithAnnotation(TestAnnotation::class.java).map { it.name })
            .contains(WhitelistedClassWithTextAnnotation::class.java.name)
    }

    @Test
    fun `should rescan when the accepted packages change`() {
        val first = scanner.getScanResult(arrayOf("com.ritense"))
        val second = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanner.scanCount).isEqualTo(2)
        assertThat(second).isNotSameAs(first)
        assertThat(first.isClosed).isTrue()
    }

    @Test
    fun `should rescan when the scan result was closed`() {
        val first = scanner.getScanResult(ACCEPT_PACKAGES)
        first.close()

        val second = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanner.scanCount).isEqualTo(2)
        assertThat(second.isClosed).isFalse()
        assertThat(second.getClassesWithAnnotation(TestAnnotation::class.java).map { it.name })
            .contains(WhitelistedClassWithTextAnnotation::class.java.name)
    }

    @Test
    fun `should close the scan result`() {
        val scanResult = scanner.getScanResult(ACCEPT_PACKAGES)

        scanner.close()

        assertThat(scanResult.isClosed).isTrue()
    }

    @Test
    fun `should scan with a configured thread count`() {
        givenScanThreads("2")

        val scanResult = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanResult.getClassesWithAnnotation(TestAnnotation::class.java).map { it.name })
            .contains(WhitelistedClassWithTextAnnotation::class.java.name)
    }

    @Test
    fun `should ignore a thread count below one`() {
        givenScanThreads("0")

        val scanResult = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanResult.getClassesWithAnnotation(TestAnnotation::class.java).map { it.name })
            .contains(WhitelistedClassWithTextAnnotation::class.java.name)
    }

    @Test
    fun `should ignore a thread count that is not a number`() {
        givenScanThreads("all of them")

        val scanResult = scanner.getScanResult(ACCEPT_PACKAGES)

        assertThat(scanResult.getClassesWithAnnotation(TestAnnotation::class.java).map { it.name })
            .contains(WhitelistedClassWithTextAnnotation::class.java.name)
    }

    private fun givenScanThreads(value: String) {
        context.environment.propertySources.addFirst(
            MapPropertySource("test", mapOf(AnnotationScanner.SCAN_THREADS_PROPERTY to value))
        )
    }

    private companion object {
        val ACCEPT_PACKAGES = arrayOf("com.whitelisted", "com.ritense")
    }
}
