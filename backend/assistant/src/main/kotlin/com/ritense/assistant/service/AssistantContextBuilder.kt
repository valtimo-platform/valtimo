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

open class AssistantContextBuilder {

    open fun buildSystemPrompt(
        userEmail: String,
        userRoles: Set<String>,
        pageContext: PageContext?
    ): String {
        val base = """
            You are a Valtimo assistant helping with case management and BPM.
            Current user: $userEmail
            User roles: ${userRoles.joinToString(", ")}

            You have access to tools for reading and previewing changes to cases and processes.
            For any modifications, you will generate a preview that the user must confirm before applying.
        """.trimIndent()

        val contextSection = pageContext?.let { ctx ->
            when (ctx.page) {
                "case-detail" -> "\n\nUser is viewing case: ${ctx.resourceId}"
                "process-definition-editor" -> "\n\nUser is editing process: ${ctx.resourceId}"
                "case-definition-editor" -> "\n\nUser is editing case definition: ${ctx.resourceId}"
                "form-editor" -> "\n\nUser is editing form: ${ctx.resourceId}"
                else -> ctx.resourceId?.let { "\n\nCurrent resource: $it (${ctx.resourceType})" } ?: ""
            }
        } ?: ""

        return base + contextSection
    }
}
