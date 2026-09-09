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

package com.ritense.assistant.web.rest.dto

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.ritense.assistant.domain.AssistantSessionEntity
import java.time.Instant
import java.util.UUID

data class ChatRequest(
    val message: String,
    val sessionId: UUID? = null,
    val context: PageContext? = null
)

data class PageContext(
    val page: String,
    val resourceType: String? = null,
    val resourceId: String? = null,
    val additionalContext: Map<String, Any>? = null
)

data class AssistantResponse(
    val message: String,
    val sessionId: String,
    val action: AssistantAction? = null
)

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(AssistantAction.Highlight::class, name = "highlight"),
    JsonSubTypes.Type(AssistantAction.Navigate::class, name = "navigate"),
    JsonSubTypes.Type(AssistantAction.ConfirmationRequired::class, name = "confirmation_required"),
    JsonSubTypes.Type(AssistantAction.ShowDiff::class, name = "show_diff")
)
sealed class AssistantAction {
    data class Highlight(val elements: List<ElementHighlight>) : AssistantAction()
    data class Navigate(val route: String, val params: Map<String, String>? = null) : AssistantAction()
    data class ConfirmationRequired(
        val preview: ChangePreview,
        val pendingActionId: String
    ) : AssistantAction()
    data class ShowDiff(
        val before: String,
        val after: String,
        val language: String
    ) : AssistantAction()
}

data class ElementHighlight(
    val selector: String,
    val label: String,
    val pulseAnimation: Boolean = false
)

data class ChangePreview(
    val description: String,
    val diff: DiffContent? = null,
    val affectedResources: List<String>? = null
)

data class DiffContent(
    val before: String,
    val after: String
)

data class SessionResponse(
    val id: UUID,
    val title: String?,
    val createdAt: Instant,
    val lastActivityAt: Instant
) {
    companion object {
        fun from(entity: AssistantSessionEntity) = SessionResponse(
            id = entity.id,
            title = entity.title,
            createdAt = entity.createdAt,
            lastActivityAt = entity.lastActivityAt
        )
    }
}

data class UpdateSessionTitleRequest(
    val title: String
)

data class ConfirmActionResponse(
    val success: Boolean,
    val result: Any? = null,
    val error: String? = null
)

data class AssistantConfigResponse(
    val enabled: Boolean,
    val configured: Boolean
)
