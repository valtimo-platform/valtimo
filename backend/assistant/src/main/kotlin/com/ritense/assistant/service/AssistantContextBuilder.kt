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

open class AssistantContextBuilder {

    companion object {
        private val pageDescriptions = mapOf(
            // User-facing pages
            "dashboard" to "User is viewing their dashboard.",
            "task-list" to "User is viewing the task list. They can filter, search, and claim tasks.",
            "task-detail" to "User is working on a task. Task ID: {taskId}, for document {documentId}.",
            "case-inspection" to "User is inspecting technical details of case {resourceId}.",
            "profile" to "User is viewing their profile settings.",
            "analysis" to "User is viewing analytics and reports.",
            "object-list" to "User is viewing objects of type {resourceId}.",
            "object-detail" to "User is viewing object {resourceId}.",
            "team-list" to "User is viewing their teams.",
            "team-detail" to "User is viewing team {resourceId}.",
            "iko-search" to "User is using IKO search {resourceId}.",
            "iko-detail" to "User is viewing IKO search result {resourceId}.",

            // Admin - Lists
            "access-control-list" to "Admin is managing access control roles.",
            "access-control-detail" to "Admin is editing role: {resourceId}",
            "process-list" to "Admin is managing process definitions.",
            "decision-table-list" to "Admin is managing decision tables.",
            "decision-table-detail" to "Admin is viewing decision table: {resourceId}",
            "decision-table-editor" to "Admin is editing decision table: {resourceId}",
            "form-list" to "Admin is managing forms.",
            "case-management-list" to "Admin is managing case definitions.",
            "dashboard-management-list" to "Admin is managing dashboard configurations.",
            "dashboard-management-detail" to "Admin is configuring dashboard: {resourceId}",
            "building-block-list" to "Admin is managing building blocks.",
            "building-block-detail" to "Admin is editing building block: {resourceId}",
            "plugin-list" to "Admin is managing plugins.",
            "object-management-list" to "Admin is managing object types.",
            "object-management-detail" to "Admin is configuring object type: {resourceId}",

            // Admin - Config pages
            "translation-management" to "Admin is managing translations.",
            "admin-settings" to "Admin is configuring application settings.",
            "process-links" to "Admin is managing process links.",
            "logging" to "Admin is viewing system logs.",
            "case-migration" to "Admin is managing case migrations.",
            "process-migration" to "Admin is managing process migrations.",
            "milestones" to "Admin is managing milestones.",
            "choice-fields" to "Admin is managing choice fields.",
            "iko-management" to "Admin is managing IKO configurations."
        )
    }

    open fun buildSystemPrompt(
        userEmail: String,
        userRoles: Set<String>,
        pageContext: PageContext?,
        toolSpecifications: List<ToolSpecification>
    ): String {
        val toolsSection = if (toolSpecifications.isNotEmpty()) {
            val toolList = toolSpecifications.joinToString("\n") { tool ->
                "- ${tool.name()}: ${tool.description()}"
            }
            """

            ## Your Capabilities

            You have access to the following tools:

            $toolList

            You can ONLY perform actions using the tools listed above. If asked to do something outside these capabilities (like creating cases, assigning tasks, sending emails, managing users, etc.), clearly explain that you cannot do that and suggest what you CAN help with instead.

            For any modifications, you will generate a preview that the user must confirm before applying.
            """.trimIndent()
        } else {
            "\n\nNo tools are currently available."
        }

        val base = """/
            You are a Valtimo assistant helping with case management and BPM configuration.
            Current user: $userEmail
            User roles: ${userRoles.joinToString(", ")}

            ## How to talk to the user

            - ALWAYS reply in the same language the user writes in. Do not switch to
              Dutch (or any other language) just because case names, form data, or tool
              results are in that language.
            - You are talking to someone doing their day-to-day work, not to a developer.
              Keep sentences short and use everyday words.
            - Never show technical identifiers such as UUIDs, database ids or class names.
              Refer to a case by its reference number or subject, and to a process or a form
              by its name.
            - Avoid internal jargon like "document id", "case definition", "resource type" or
              "configuration" unless the user used those words first.
            - Lead with the answer. Do not open with a summary of what you are about to do.
            - When you need more information, ask one plain question instead of listing
              numbered options.
            - If something is outside what you can do, say so in one sentence and offer the
              closest thing you can do instead.
        """.trimIndent()

        val contextSection = pageContext?.let { ctx ->
            buildContextSection(ctx)
        } ?: ""

        return base + toolsSection + contextSection
    }

    private fun buildContextSection(ctx: PageContext): String {
        val additionalInfo = ctx.additionalContext?.entries?.joinToString(", ") { "${it.key}=${it.value}" } ?: ""

        return when (ctx.page) {
            "case-detail" -> """

                ## Current Context
                User is viewing a case detail page.
                ${if (additionalInfo.isNotEmpty()) "- Additional: $additionalInfo" else ""}
                When the user says "this case" or "the current case", they mean the case
                with id ${ctx.resourceId}. Use that id when calling tools, but do not show
                it to the user - name the case by its reference number or subject instead.
            """.trimIndent()

            "case-list" -> """

                ## Current Context
                User is viewing the case list for case definition: ${ctx.resourceId}
            """.trimIndent()

            "process-definition-detail" -> """

                ## Current Context
                User is viewing process definition: ${ctx.resourceId}
            """.trimIndent()

            "case-definition-editor" -> """

                ## Current Context
                User is editing case definition: ${ctx.resourceId}
                ${if (additionalInfo.isNotEmpty()) "Version: ${ctx.additionalContext?.get("versionTag")}" else ""}
            """.trimIndent()

            "form-flow-editor" -> """

                ## Current Context
                User is editing form flow: ${ctx.resourceId}
            """.trimIndent()

            "form-builder" -> """

                ## Current Context
                User is editing form: ${ctx.resourceId}
            """.trimIndent()

            else -> {
                pageDescriptions[ctx.page]?.let { template ->
                    val description = interpolateTemplate(template, ctx)
                    """

                    ## Current Context
                    $description
                    """.trimIndent()
                } ?: ctx.resourceId?.let {
                    """

                    ## Current Context
                    Page: ${ctx.page}
                    Resource: $it (${ctx.resourceType ?: "unknown"})
                    """.trimIndent()
                } ?: ""
            }
        }
    }

    private fun interpolateTemplate(template: String, ctx: PageContext): String {
        var result = template
        ctx.resourceId?.let { result = result.replace("{resourceId}", it) }
        ctx.additionalContext?.forEach { (key, value) ->
            result = result.replace("{$key}", value.toString())
        }
        return result
    }
}
