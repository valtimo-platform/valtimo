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

import com.ritense.assistant.web.rest.dto.PageContext
import dev.langchain4j.agent.tool.ToolSpecification
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse

class AssistantContextBuilderTest {

    private lateinit var builder: AssistantContextBuilder

    @BeforeEach
    fun setUp() {
        builder = AssistantContextBuilder()
    }

    @Test
    fun `should include user email in system prompt`() {
        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = null,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "user@test.com")
    }

    @Test
    fun `should include user roles in system prompt`() {
        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_ADMIN", "ROLE_USER"),
            pageContext = null,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "ROLE_ADMIN")
        assertContains(prompt, "ROLE_USER")
    }

    @Test
    fun `should include base assistant instructions`() {
        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = null,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "Valtimo assistant")
        assertContains(prompt, "case management")
    }

    @Test
    fun `should include case detail context`() {
        val context = PageContext(
            page = "case-detail",
            resourceType = "document",
            resourceId = "case-123"
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "case detail page")
        assertContains(prompt, "case-123")
    }

    @Test
    fun `should include process definition editor context`() {
        val context = PageContext(
            page = "process-definition-detail",
            resourceType = "processDefinition",
            resourceId = "loan-process"
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "process definition")
        assertContains(prompt, "loan-process")
    }

    @Test
    fun `should include case definition editor context`() {
        val context = PageContext(
            page = "case-definition-editor",
            resourceType = "case-definition",
            resourceId = "loan-case"
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "editing case definition")
        assertContains(prompt, "loan-case")
    }

    @Test
    fun `should include case definition editor context with version`() {
        val context = PageContext(
            page = "case-definition-editor",
            resourceType = "caseDefinition",
            resourceId = "bezwaar",
            additionalContext = mapOf("versionTag" to "1.0.1")
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_ADMIN"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "editing case definition")
        assertContains(prompt, "bezwaar")
        assertContains(prompt, "Version: 1.0.1")
    }

    @Test
    fun `should include form editor context`() {
        val context = PageContext(
            page = "form-builder",
            resourceType = "form",
            resourceId = "application-form"
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "editing form")
        assertContains(prompt, "application-form")
    }

    @Test
    fun `should include generic resource context for unknown pages`() {
        val context = PageContext(
            page = "other-page",
            resourceType = "document",
            resourceId = "doc-456"
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertContains(prompt, "doc-456")
        assertContains(prompt, "document")
    }

    @Test
    fun `should handle page context without resourceId`() {
        val context = PageContext(
            page = "dashboard",
            resourceType = null,
            resourceId = null
        )

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = context,
            toolSpecifications = emptyList()
        )

        assertFalse(prompt.contains("Current resource"))
    }

    @Test
    fun `should mention confirmation requirement when tools available`() {
        val toolSpec = ToolSpecification.builder()
            .name("testTool")
            .description("A test tool")
            .build()

        val prompt = builder.buildSystemPrompt(
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            pageContext = null,
            toolSpecifications = listOf(toolSpec)
        )

        assertContains(prompt, "confirm")
    }

}
