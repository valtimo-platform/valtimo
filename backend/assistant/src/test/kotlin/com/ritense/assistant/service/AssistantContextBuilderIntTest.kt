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

package com.ritense.assistant.service

import com.ritense.assistant.BaseIntegrationTest
import dev.langchain4j.agent.tool.ToolSpecification
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import kotlin.test.assertContains
import kotlin.test.assertTrue

class AssistantContextBuilderIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var contextBuilder: AssistantContextBuilder

    @Test
    fun `should include tool names and descriptions in system prompt`() {
        val tools = listOf(
            ToolSpecification.builder()
                .name("listCaseDefinitions")
                .description("List all case definitions")
                .build(),
            ToolSpecification.builder()
                .name("getProcessDefinition")
                .description("Get process definition BPMN XML")
                .build()
        )

        val prompt = contextBuilder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_ADMIN"),
            pageContext = null,
            toolSpecifications = tools
        )

        assertContains(prompt, "listCaseDefinitions")
        assertContains(prompt, "List all case definitions")
        assertContains(prompt, "getProcessDefinition")
        assertContains(prompt, "Get process definition BPMN XML")
    }

    @Test
    fun `should include capability constraint when tools available`() {
        val toolSpec = ToolSpecification.builder()
            .name("testTool")
            .description("A test tool")
            .build()

        val prompt = contextBuilder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = null,
            toolSpecifications = listOf(toolSpec)
        )

        assertContains(prompt, "ONLY perform actions using the tools listed above")
    }

    @Test
    fun `should indicate no tools available when list is empty`() {
        val prompt = contextBuilder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = null,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "No tools are currently available")
    }
}
