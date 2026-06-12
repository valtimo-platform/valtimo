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

package com.ritense.valtimo.processbean

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationContext

class ProcessBeanServiceImplTest {

    private lateinit var service: ProcessBeanService
    private lateinit var applicationContext: ApplicationContext

    @BeforeEach
    fun setUp() {
        val processBeans = mapOf(
            "testBean" to TestBean(),
            "annotatedBean" to AnnotatedBean()
        )
        applicationContext = mock()
        whenever(applicationContext.getBeansWithAnnotation(ProcessBean::class.java)).thenReturn(processBeans)
        service = ProcessBeanServiceImpl(applicationContext)
    }

    @Test
    fun `should return all process beans sorted by name`() {
        val beans = service.getProcessBeans()

        assertThat(beans).hasSize(2)
        assertThat(beans[0].name).isEqualTo("annotatedBean")
        assertThat(beans[1].name).isEqualTo("testBean")
    }

    @Test
    fun `should return bean by name`() {
        val bean = service.getProcessBean("testBean")

        assertThat(bean).isNotNull
        assertThat(bean!!.name).isEqualTo("testBean")
        assertThat(bean.className).contains("TestBean")
    }

    @Test
    fun `should return null for non-existent bean`() {
        val bean = service.getProcessBean("nonExistent")

        assertThat(bean).isNull()
    }

    @Test
    fun `should discover public methods and exclude Object methods`() {
        val bean = service.getProcessBean("testBean")

        assertThat(bean).isNotNull
        val methodNames = bean!!.methods.map { it.name }

        assertThat(methodNames).contains("doSomething", "calculate")
        assertThat(methodNames).doesNotContain("equals", "hashCode", "toString", "getClass")
    }

    @Test
    fun `should include method parameters with types`() {
        val bean = service.getProcessBean("testBean")
        val calculateMethod = bean!!.methods.find { it.name == "calculate" }

        assertThat(calculateMethod).isNotNull
        assertThat(calculateMethod!!.parameters).hasSize(2)
        assertThat(calculateMethod.parameters[0].type).isEqualTo("int")
        assertThat(calculateMethod.parameters[1].type).isEqualTo("int")
        assertThat(calculateMethod.returnType).isEqualTo("int")
    }

    @Test
    fun `should extract description from ProcessBean annotation`() {
        val bean = service.getProcessBean("annotatedBean")

        assertThat(bean).isNotNull
        assertThat(bean!!.description).isEqualTo("A bean with description")
    }

    @Test
    fun `should have null description when annotation has no description`() {
        val bean = service.getProcessBean("testBean")

        assertThat(bean).isNotNull
        assertThat(bean!!.description).isNull()
    }

    @Test
    fun `should extract description from ProcessBeanMethod annotation`() {
        val bean = service.getProcessBean("annotatedBean")
        val method = bean!!.methods.find { it.name == "documentedMethod" }

        assertThat(method).isNotNull
        assertThat(method!!.description).isEqualTo("Does something useful")
        assertThat(method.example).isEqualTo("\${annotatedBean.documentedMethod('value')}")
    }

    @Test
    fun `should have null description for methods without annotation`() {
        val bean = service.getProcessBean("annotatedBean")
        val method = bean!!.methods.find { it.name == "undocumentedMethod" }

        assertThat(method).isNotNull
        assertThat(method!!.description).isNull()
        assertThat(method.example).isNull()
    }

    // Test fixtures

    class TestBean {
        fun doSomething(): String = "done"
        fun calculate(a: Int, b: Int): Int = a + b
    }

    @ProcessBean(description = "A bean with description")
    class AnnotatedBean {
        @ProcessBeanMethod(
            description = "Does something useful",
            example = "\${annotatedBean.documentedMethod('value')}"
        )
        fun documentedMethod(input: String): String = input.uppercase()

        fun undocumentedMethod(): Unit {}
    }
}
