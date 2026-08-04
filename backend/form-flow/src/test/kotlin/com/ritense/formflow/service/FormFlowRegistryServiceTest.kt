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

package com.ritense.formflow.service

import com.fasterxml.jackson.databind.jsontype.NamedType
import com.ritense.formflow.domain.definition.configuration.step.CustomComponentStepTypeProperties
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.expression.FormFlowBean
import com.ritense.formflow.handler.FormFlowStepTypeHandler
import com.ritense.formflow.web.rest.dto.FormFlowExpressionParameterDto
import com.ritense.formflow.web.rest.dto.FormFlowStepTypePropertyDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationContext

internal class FormFlowRegistryServiceTest {

    lateinit var applicationContext: ApplicationContext
    lateinit var formFlowRegistryService: FormFlowRegistryService

    @BeforeEach
    fun beforeEach() {
        applicationContext = mock()
        whenever(applicationContext.getBeansWithAnnotation(FormFlowBean::class.java))
            .thenReturn(mapOf("testExpressionBean" to TestExpressionBean()))

        formFlowRegistryService = FormFlowRegistryService(
            stepTypeHandlers = listOf(
                stepTypeHandler("form"),
                stepTypeHandler("custom-component"),
                stepTypeHandler("no-properties"),
            ),
            stepPropertiesTypes = listOf(
                NamedType(FormStepTypeProperties::class.java, "form"),
                NamedType(CustomComponentStepTypeProperties::class.java, "custom-component"),
                NamedType(String::class.java, "no-properties"),
            ),
            applicationContext = applicationContext,
        )
    }

    @Test
    fun `should return step types with their properties`() {
        val registry = formFlowRegistryService.getRegistry()

        assertThat(registry.stepTypes.map { it.name })
            .containsExactly("custom-component", "form", "no-properties")

        val formStepType = registry.stepTypes.single { it.name == "form" }
        assertThat(formStepType.properties)
            .containsExactly(FormFlowStepTypePropertyDto(name = "definition", type = "String"))

        val customComponentStepType = registry.stepTypes.single { it.name == "custom-component" }
        assertThat(customComponentStepType.properties)
            .containsExactly(FormFlowStepTypePropertyDto(name = "componentId", type = "String"))
    }

    @Test
    fun `should ignore step properties types that do not implement StepTypeProperties`() {
        val registry = formFlowRegistryService.getRegistry()

        val noPropertiesStepType = registry.stepTypes.single { it.name == "no-properties" }
        assertThat(noPropertiesStepType.properties).isEmpty()
    }

    @Test
    fun `should return expression beans with public methods only`() {
        val registry = formFlowRegistryService.getRegistry()

        val bean = registry.expressionBeans.single()
        assertThat(bean.name).isEqualTo("testExpressionBean")
        assertThat(bean.methods.map { it.name })
            .containsExactly("doSomething", "doSomething", "startFlow")
    }

    @Test
    fun `should return expression method parameter names and types`() {
        val registry = formFlowRegistryService.getRegistry()

        val bean = registry.expressionBeans.single()
        val method = bean.methods.single { it.name == "doSomething" && it.parameters.size == 2 }
        assertThat(method.parameters).containsExactly(
            FormFlowExpressionParameterDto(name = "input", type = "String"),
            FormFlowExpressionParameterDto(name = "count", type = "int"),
        )
        assertThat(method.returnType).isEqualTo("boolean")
    }

    @Test
    fun `should cache registry after first call`() {
        val firstRegistry = formFlowRegistryService.getRegistry()
        val secondRegistry = formFlowRegistryService.getRegistry()

        assertThat(secondRegistry).isSameAs(firstRegistry)
        verify(applicationContext, times(1)).getBeansWithAnnotation(FormFlowBean::class.java)
    }

    private fun stepTypeHandler(type: String): FormFlowStepTypeHandler {
        val handler = mock<FormFlowStepTypeHandler>()
        whenever(handler.getType()).thenReturn(type)
        return handler
    }

    @FormFlowBean
    class TestExpressionBean {

        fun doSomething(input: String): Boolean = input.isNotEmpty()

        fun doSomething(input: String, count: Int): Boolean = input.length == count

        fun startFlow(properties: Map<String, Any>) {
            properties.isEmpty()
        }

        @Suppress("unused")
        private fun hidden(): String = "hidden"
    }
}
