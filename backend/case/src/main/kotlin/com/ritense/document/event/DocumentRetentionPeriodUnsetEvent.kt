/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.view.AuditView
import com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentNotNull
import java.time.LocalDateTime
import java.util.Objects
import java.util.UUID

class DocumentRetentionPeriodUnsetEvent @JsonCreator constructor(
    id: UUID,
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    private var documentId: UUID
) : AuditMetaData(id, origin, occurredOn, user), AuditEvent {

    init {
        assertArgumentNotNull(documentId, "documentId is required")
    }

    fun setDocumentId(documentId: UUID) {
        this.documentId = documentId
    }

    @JsonView(AuditView.Internal::class)
    @JsonIgnore(false)
    override fun getDocumentId(): UUID = documentId

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is DocumentRetentionPeriodUnsetEvent) return false
        if (!super.equals(other)) return false

        return documentId == other.documentId
    }

    override fun hashCode(): Int {
        return Objects.hash(super.hashCode(), documentId)
    }
}
