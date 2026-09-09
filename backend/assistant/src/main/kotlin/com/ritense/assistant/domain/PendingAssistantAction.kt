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

package com.ritense.assistant.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "pending_assistant_action")
class PendingAssistantAction(
    @Id
    @Column(name = "id", nullable = false, updatable = false)
    val id: UUID,

    @Column(name = "session_id", nullable = false)
    val sessionId: UUID,

    @Column(name = "user_id", nullable = false)
    val userId: String,

    @Column(name = "tool", nullable = false)
    val tool: String,

    @Column(name = "params", nullable = false, columnDefinition = "TEXT")
    val params: String,

    @Column(name = "resource_type")
    val resourceType: String? = null,

    @Column(name = "resource_id")
    val resourceId: String? = null,

    @Column(name = "preview_description", columnDefinition = "TEXT")
    val previewDescription: String? = null,

    @Column(name = "diff_before", columnDefinition = "TEXT")
    val diffBefore: String? = null,

    @Column(name = "diff_after", columnDefinition = "TEXT")
    val diffAfter: String? = null,

    @Column(name = "affected_resources", columnDefinition = "TEXT")
    val affectedResources: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant,

    @Column(name = "expires_at", nullable = false)
    val expiresAt: Instant
) {
    fun isExpired(): Boolean = Instant.now().isAfter(expiresAt)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PendingAssistantAction) return false
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()
}
