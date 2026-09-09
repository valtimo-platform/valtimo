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

package com.ritense.assistant.tool

import com.ritense.assistant.web.rest.dto.PageContext
import java.util.UUID

data class ToolContext(
    val userId: String,
    val userEmail: String,
    val userRoles: Set<String>,
    val authToken: String,
    val sessionId: UUID,
    val pageContext: PageContext? = null
)

object ToolContextHolder {
    private val contextHolder = ThreadLocal<ToolContext>()

    fun set(context: ToolContext) {
        contextHolder.set(context)
    }

    fun get(): ToolContext {
        return contextHolder.get()
            ?: throw IllegalStateException("ToolContext not set. Ensure tool execution is within AssistantService.chat()")
    }

    fun getOrNull(): ToolContext? = contextHolder.get()

    fun clear() {
        contextHolder.remove()
    }

    inline fun <T> withContext(context: ToolContext, block: () -> T): T {
        set(context)
        return try {
            block()
        } finally {
            clear()
        }
    }
}
