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

package com.ritense.valtimo.web.autoconfigure

import com.ritense.valtimo.contract.endpoint.EndpointDescription
import io.swagger.v3.oas.models.Operation
import org.junit.jupiter.api.Test
import org.springframework.web.method.HandlerMethod
import kotlin.test.assertEquals
import kotlin.test.assertNull

class EndpointDescriptionOperationCustomizerTest {

    private val customizer = OpenApiAutoConfiguration().endpointDescriptionOperationCustomizer()

    @Test
    fun `copies the English text to the operation summary`() {
        val operation = Operation()

        customizer.customize(operation, handlerMethod("annotated"))

        assertEquals("List cases", operation.summary)
    }

    @Test
    fun `leaves the summary untouched when the annotation is absent`() {
        val operation = Operation()

        customizer.customize(operation, handlerMethod("plain"))

        assertNull(operation.summary)
    }

    @Test
    fun `does not override an explicit summary`() {
        val operation = Operation().summary("explicit summary")

        customizer.customize(operation, handlerMethod("annotated"))

        assertEquals("explicit summary", operation.summary)
    }

    private fun handlerMethod(methodName: String): HandlerMethod =
        HandlerMethod(TestController(), TestController::class.java.getDeclaredMethod(methodName))

    class TestController {
        @EndpointDescription(en = "List cases", nl = "Toon zaken")
        fun annotated() {
        }

        fun plain() {
        }
    }
}
