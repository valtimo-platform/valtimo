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

package com.ritense.document.event

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.view.AuditView
import com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentNotNull
import java.time.LocalDateTime
import java.util.Objects
import java.util.UUID

class JsonSchemaDocumentInspectionEditedEvent @JsonCreator constructor(
    id: UUID,
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    private val documentId: UUID,
    private val previousContent: String,
    private val newContent: String
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    init {
        assertArgumentNotNull(documentId, "documentId is required")
    }

    @JsonView(AuditView.Internal::class)
    @JsonIgnore(false)
    override fun getDocumentId(): UUID = documentId

    @JsonProperty
    @JsonView(AuditView.Internal::class)
    fun getPreviousContent(): String = previousContent

    @JsonProperty
    @JsonView(AuditView.Internal::class)
    fun getNewContent(): String = newContent

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is JsonSchemaDocumentInspectionEditedEvent) return false
        if (!super.equals(other)) return false
        return documentId == other.documentId
            && previousContent == other.previousContent
            && newContent == other.newContent
    }

    override fun hashCode(): Int {
        return Objects.hash(super.hashCode(), documentId, previousContent, newContent)
    }
}