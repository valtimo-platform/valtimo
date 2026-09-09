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

        val base = """
            You are a Valtimo assistant helping with case management and BPM configuration.
            Current user: $userEmail
            User roles: ${userRoles.joinToString(", ")}

            ## How to talk to the user

            - Reply in the same language the user writes in.
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
            val additionalInfo = ctx.additionalContext?.entries?.joinToString(", ") { "${it.key}=${it.value}" } ?: ""
            when (ctx.page) {
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
                else -> ctx.resourceId?.let { """

                    ## Current Context
                    Page: ${ctx.page}
                    Resource: $it (${ctx.resourceType ?: "unknown"})
                """.trimIndent() } ?: ""
            }
        } ?: ""

        return base + toolsSection + contextSection
    }
}
