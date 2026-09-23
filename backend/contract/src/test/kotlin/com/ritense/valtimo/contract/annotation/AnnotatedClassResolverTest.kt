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
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.core.env.MapPropertySource

class AnnotatedClassResolverTest {

    private lateinit var context: AnnotationConfigApplicationContext

    private var sharedScanner: CountingAnnotationScanner? = null

    @BeforeEach
    fun before() {
        context = AnnotationConfigApplicationContext()
        context.environment.propertySources.addFirst(
            MapPropertySource("test", mapOf("valtimo.annotation-scan.accepted-packages" to "com.whitelisted"))
        )
        context.refresh()
    }

    @AfterEach
    fun after() {
        // Manually registered singletons are not destroyed by the context
        sharedScanner?.close()
        context.close()
    }

    @Test
    fun `should scan once for multiple queries on one resolver`() {
        val scanner = registerSharedScanner()
        val resolver = TestResolver(context)

        resolver.findClassesWithAnnotation<TestAnnotation>()
        resolver.findClassesWithAnnotation<TestAnnotation>()
        resolver.findMethodsWithAnnotation<TestAnnotation>()

        assertThat(scanner.scanCount).isEqualTo(1)
    }

    @Test
    fun `should scan once for multiple resolvers sharing the scanner bean`() {
        val scanner = registerSharedScanner()

        val first = TestResolver(context).findClassesWithAnnotation<TestAnnotation>()
        val second = TestResolver(context).findClassesWithAnnotation<TestAnnotation>()

        assertThat(scanner.scanCount).isEqualTo(1)
        assertThat(first.keys).containsExactlyElementsOf(second.keys)
        assertThat(first.keys).contains(WhitelistedClassWithTextAnnotation::class.java)
    }

    @Test
    fun `should return the same results for a repeated query`() {
        registerSharedScanner()
        val resolver = TestResolver(context)

        val first = resolver.findMethodsWithAnnotation<TestAnnotation>()
        val second = resolver.findMethodsWithAnnotation<TestAnnotation>()

        assertThat(first).isEqualTo(second)
        assertThat(first.map { it.name }).contains("whitelistedAnnotatedMethod")
    }

    @Test
    fun `should still resolve after the shared scan result was closed`() {
        val scanner = registerSharedScanner()
        val resolver = TestResolver(context)
        resolver.findClassesWithAnnotation<TestAnnotation>()

        scanner.close()

        assertThat(resolver.findClassesWithAnnotation<TestAnnotation>().keys)
            .contains(WhitelistedClassWithTextAnnotation::class.java)
        assertThat(scanner.scanCount).isEqualTo(2)
    }

    @Test
    fun `should resolve without a scanner bean`() {
        val resolver = TestResolver(context)

        val annotatedClasses = resolver.findClassesWithAnnotation<TestAnnotation>().keys

        assertThat(annotatedClasses).contains(WhitelistedClassWithTextAnnotation::class.java)
    }

    @Test
    fun `should close the scanner it created itself`() {
        val resolver = TestResolver(context)
        val scanResult = resolver.scanResult()

        resolver.close()

        assertThat(scanResult.isClosed).isTrue()
    }

    @Test
    fun `should not close the shared scanner bean`() {
        registerSharedScanner()
        val resolver = TestResolver(context)
        val scanResult = resolver.scanResult()

        resolver.close()

        assertThat(scanResult.isClosed).isFalse()
    }

    private fun registerSharedScanner(): CountingAnnotationScanner {
        return CountingAnnotationScanner(context).also {
            context.beanFactory.registerSingleton("annotationScanner", it)
            sharedScanner = it
        }
    }

    private class TestResolver(context: ApplicationContext) : AnnotatedClassResolver(context)
}
