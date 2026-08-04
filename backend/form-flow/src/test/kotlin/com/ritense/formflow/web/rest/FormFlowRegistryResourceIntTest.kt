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

package com.ritense.formflow.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.formflow.BaseIntegrationTest
import com.ritense.formflow.web.rest.dto.FormFlowRegistryDto
import com.ritense.formflow.web.rest.dto.FormFlowStepTypePropertyDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class FormFlowRegistryResourceIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var objectMapper: ObjectMapper

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders
            .webAppContextSetup(this.webApplicationContext)
            .build()
    }

    @Test
    fun `should return step types with their properties`() {
        val registry = getRegistry()

        assertThat(registry.stepTypes.map { it.name })
            .contains("form", "custom-component")

        val formStepType = registry.stepTypes.single { it.name == "form" }
        assertThat(formStepType.properties)
            .containsExactly(FormFlowStepTypePropertyDto(name = "definition", type = "String"))

        val customComponentStepType = registry.stepTypes.single { it.name == "custom-component" }
        assertThat(customComponentStepType.properties)
            .containsExactly(FormFlowStepTypePropertyDto(name = "componentId", type = "String"))
    }

    @Test
    fun `should return expression beans with their methods`() {
        val registry = getRegistry()

        val valtimoFormFlow = registry.expressionBeans.single { it.name == "valtimoFormFlow" }
        assertThat(valtimoFormFlow.methods.map { it.name })
            .containsExactly(
                "completeTask",
                "completeTask",
                "completeTask",
                "startCase",
                "startSupportingProcess",
            )

        val completeTask = valtimoFormFlow.methods
            .single { it.name == "completeTask" && it.parameters.size == 3 }
        assertThat(completeTask.parameters.map { it.name })
            .containsExactly("additionalProperties", "submissionData", "submissionSavePath")
        assertThat(completeTask.parameters.map { it.type })
            .containsExactly("Map", "JsonNode", "Map")
    }

    private fun getRegistry(): FormFlowRegistryDto {
        val response = mockMvc
            .perform(get("/api/management/v1/form-flow/registry"))
            .andDo(print())
            .andExpect(status().isOk)
            .andReturn()
            .response
            .contentAsString

        return objectMapper.readValue<FormFlowRegistryDto>(response)
    }
}
