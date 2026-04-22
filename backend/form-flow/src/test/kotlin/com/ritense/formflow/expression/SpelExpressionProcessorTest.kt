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

import com.ritense.formflow.expression.spel.SpelExpressionProcessor
import com.ritense.formflow.expression.spel.SpelExpressionProcessorFactory
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.expression.spel.SpelEvaluationException

internal class SpelExpressionProcessorTest {

    @Test
    fun `should validate SPeL expression`() {
        val expressionProcessor = SpelExpressionProcessor()

        expressionProcessor.validate("\${'Hello '+'World!'}")
    }

    @Test
    fun `should throw exception when error in syntax of expression`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThat(assertThrows<ExpressionParseException> {
            expressionProcessor.validate("\${'Hello +'World!'}")
        }.message).isEqualTo("Failed to parse expression: '\${'Hello +'World!'}'")
    }

    @Test
    fun `should return result when executing valid expression`() {
        val expressionProcessor = SpelExpressionProcessor()

        val result = expressionProcessor.process<Number>("\${3 / 1}")

        assertThat(result).isEqualTo(3)
    }

    @Test
    fun `should throw exception when error while executing expression`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThat(assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Number>("\${3 / 0}")
        }.message).isEqualTo("Error while executing expression: '\${3 / 0}'")
    }

    @Test
    fun `should block OS command execution via Runtime`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${T(java.lang.Runtime).getRuntime().exec('id')}")
        }
    }

    @Test
    fun `should block access to environment variables via System getenv`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${T(java.lang.System).getenv()}")
        }
    }

    @Test
    fun `should block class loading via Class forName`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${T(java.lang.Class).forName('java.lang.Runtime')}")
        }
    }

    @Test
    fun `should block access to system properties`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${T(java.lang.System).getProperties()}")
        }
    }

    @Test
    fun `should block ProcessBuilder command execution`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${new java.lang.ProcessBuilder('id').start()}")
        }
    }

    @Test
    fun `should block arbitrary constructor invocation`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${new java.io.File('/etc/passwd').exists()}")
        }
    }

    @Test
    fun `should block access to class loader`() {
        val expressionProcessor = SpelExpressionProcessor()

        assertThrows<ExpressionExecutionException> {
            expressionProcessor.process<Any>("\${T(java.lang.Thread).currentThread().getContextClassLoader()}")
        }
    }

    @Test
    fun `should still allow safe string concatenation`() {
        val expressionProcessor = SpelExpressionProcessor()

        val result = expressionProcessor.process<String>("\${'Hello ' + 'World'}")

        assertThat(result).isEqualTo("Hello World")
    }

    @Test
    fun `should still allow safe arithmetic expressions`() {
        val expressionProcessor = SpelExpressionProcessor()

        val result = expressionProcessor.process<Number>("\${2 + 3}")

        assertThat(result).isEqualTo(5)
    }

    @Test
    fun `should allow accessing form flow beans from context map`() {
        val factory = SpelExpressionProcessorFactory()
        factory.formFlowBeans = mapOf("greeting" to "Hello World")
        val processor = factory.create()

        val result = processor.process<String>("\${greeting}")

        assertThat(result).isEqualTo("Hello World")
    }

    @Test
    fun `should allow accessing variables passed to the processor`() {
        val factory = SpelExpressionProcessorFactory()
        factory.formFlowBeans = emptyMap()
        val processor = factory.create(mapOf("username" to "John"))

        val result = processor.process<String>("\${username}")

        assertThat(result).isEqualTo("John")
    }

}