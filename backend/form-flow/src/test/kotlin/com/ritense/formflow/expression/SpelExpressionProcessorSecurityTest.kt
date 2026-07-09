/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.formflow.expression

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.formflow.expression.spel.SpelExpressionProcessorFactory
import com.ritense.formflow.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.nio.file.Files
import kotlin.io.path.deleteIfExists
import kotlin.io.path.exists

/**
 * Regression test for the SpEL injection / RCE fix in the form-flow expression evaluator.
 *
 * The factory used to build an unrestricted [org.springframework.expression.spel.support.StandardEvaluationContext],
 * which allowed admin-authored step expressions (onOpen/onComplete/onBack/nextSteps[].condition) to reference
 * arbitrary Java types (T(...)), invoke constructors and static methods, and therefore run OS commands.
 *
 * These tests exercise the *real* factory path and assert that:
 *  - the code-execution surface is closed (T(...), constructors, static/class navigation all fail), and
 *  - every legitimate expression feature still works (map/JSON read, JSON assignment, bean method calls, operators).
 */
internal class SpelExpressionProcessorSecurityTest {

    /** Mirrors a registered @FormFlowBean; instance-method calls on such beans must keep working. */
    class StubFormFlowBean {
        fun echo(value: String): String = value
        fun returnTrue(): Boolean = true
    }

    private fun processor(
        beans: Map<String, Any> = emptyMap(),
        variables: Map<String, Any> = emptyMap()
    ): ExpressionProcessor = SpelExpressionProcessorFactory()
        .apply { setFlowProcessBeans(beans) }
        .create(variables)

    private fun submissionData(json: String): ObjectNode =
        MapperSingleton.get().readTree(json) as ObjectNode

    // --- security: the remote-code-execution surface must be closed ---

    @Test
    fun `blocks type references to arbitrary Java via T()`() {
        assertThrows<ExpressionExecutionException> {
            processor().process<String>("\${T(java.lang.System).getProperty('user.name')}")
        }
    }

    @Test
    fun `blocks Runtime exec and does not run the OS command`() {
        val marker = Files.createTempDirectory("valtimo_ff_rce_fix").resolve("valtimo_ff_rce_poc")
        marker.deleteIfExists()
        val markerPath = marker.toString().replace("\\", "/")
        val expression = "\${T(java.lang.Runtime).getRuntime()" +
            ".exec(new String[]{'/bin/sh','-c','touch $markerPath'}).waitFor()}"

        try {
            assertThrows<ExpressionExecutionException> { processor().process<Any>(expression) }
            assertThat(marker.exists())
                .describedAs("the injected OS command must NOT have executed")
                .isFalse()
        } finally {
            marker.deleteIfExists()
        }
    }

    @Test
    fun `blocks constructor invocation via new`() {
        assertThrows<ExpressionExecutionException> {
            processor().process<Any>("\${new java.lang.String('pwned')}")
        }
    }

    @Test
    fun `blocks class navigation and static method resolution`() {
        assertThrows<ExpressionExecutionException> {
            processor().process<Any>("\${'x'.class.forName('java.lang.Runtime')}")
        }
    }

    // --- functionality: legitimate expressions must keep working ---

    @Test
    fun `allows arithmetic and string operators`() {
        assertThat(processor().process<Number>("\${1 + 2}")).isEqualTo(3)
        assertThat(processor().process<String>("\${'Hello ' + 'World!'}")).isEqualTo("Hello World!")
    }

    @Test
    fun `allows reading map variables and json submission data`() {
        val vars = mapOf("step" to mapOf("submissionData" to submissionData("""{"firstName":"Henk","age":42}""")))

        assertThat(processor(variables = vars).process<String>("\${step.submissionData.firstName}"))
            .isEqualTo("Henk")
        assertThat(processor(variables = vars).process<Boolean>("\${step.submissionData.age >= 21}"))
            .isTrue()
    }

    @Test
    fun `allows writing back to json submission data via assignment`() {
        val data = submissionData("""{"firstName":"Jan"}""")
        val vars = mapOf("step" to mapOf("submissionData" to data))

        processor(variables = vars).process<Any>("\${step.submissionData.firstName = 'Henk'}")

        assertThat(data.get("firstName").asText()).isEqualTo("Henk")
    }

    @Test
    fun `allows instance-method calls on a registered form-flow bean`() {
        val beans = mapOf("myBean" to StubFormFlowBean())

        assertThat(processor(beans = beans).process<String>("\${myBean.echo('hi')}")).isEqualTo("hi")
        assertThat(processor(beans = beans).process<Boolean>("\${myBean.returnTrue()}")).isTrue()
    }
}
