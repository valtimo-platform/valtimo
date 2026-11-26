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

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.media.BooleanSchema
import io.swagger.v3.oas.models.media.ObjectSchema
import io.swagger.v3.oas.models.media.StringSchema
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class Jackson2JsonNodeSchemaCustomizerTest {

    private val customizer = OpenApiAutoConfiguration().jackson2JsonNodeSchemaCustomizer()

    @Test
    fun `documents JsonNode as a free-form object`() {
        val beanLike = ObjectSchema().addProperty("textual", BooleanSchema()).addProperty("pojo", BooleanSchema())
        val openApi = OpenAPI().components(Components().addSchemas("JsonNode", beanLike).addSchemas("Other", StringSchema()))

        customizer.customise(openApi)

        val jsonNode = openApi.components.schemas.getValue("JsonNode")
        assertEquals("object", jsonNode.type)
        assertNull(jsonNode.properties)
        assertEquals("string", openApi.components.schemas.getValue("Other").type)
    }

    @Test
    fun `leaves a document without JsonNode alone`() {
        val openApi = OpenAPI()

        customizer.customise(openApi)

        assertNull(openApi.components)
    }
}
