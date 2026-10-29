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

import com.ritense.valtimo.contract.BaseIntegrationTest
import com.ritense.valtimo.contract.custom.SecondTestAnnotatedClassResolver
import com.ritense.valtimo.contract.custom.TestAnnotatedClassResolver
import com.ritense.valtimo.contract.custom.TestAnnotation
import com.whitelisted.WhitelistedClassWithTextAnnotation
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class AnnotationScannerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var testAnnotatedClassResolver: TestAnnotatedClassResolver

    @Autowired
    lateinit var secondTestAnnotatedClassResolver: SecondTestAnnotatedClassResolver

    @Autowired
    lateinit var annotationScanner: AnnotationScanner

    @Test
    fun `should share one scan result between all resolvers in the context`() {
        val scanResult = testAnnotatedClassResolver.scanResult()

        assertThat(secondTestAnnotatedClassResolver.scanResult()).isSameAs(scanResult)
        assertThat(annotationScanner.getScanResult(testAnnotatedClassResolver.getAcceptPackages()))
            .isSameAs(scanResult)
    }

    @Test
    fun `should answer class and method queries from the shared scan result`() {
        val annotatedClasses = secondTestAnnotatedClassResolver.findClassesWithAnnotation<TestAnnotation>().keys
        val annotatedMethods = secondTestAnnotatedClassResolver.findMethodsWithAnnotation<TestAnnotation>()

        assertThat(annotatedClasses).contains(WhitelistedClassWithTextAnnotation::class.java)
        assertThat(annotatedMethods.map { it.name }).contains("whitelistedAnnotatedMethod")
    }

    @Test
    fun `should release the shared scan result after startup and rebuild it for a late consumer`() {
        val scanResult = testAnnotatedClassResolver.scanResult()

        annotationScanner.releaseAfterStartup()

        assertThat(scanResult.isClosed).isTrue()
        val rebuilt = testAnnotatedClassResolver.scanResult()
        assertThat(rebuilt).isNotSameAs(scanResult)
        assertThat(rebuilt.isClosed).isFalse()
    }
}
