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
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import com.ritense.valtimo.contract.audit.view.AuditView
import com.ritense.valtimo.contract.utils.AssertionConcern.assertArgumentNotNull
import java.time.LocalDateTime
import java.util.Objects
import java.util.UUID

class DocumentRetentionPeriodSetEvent @JsonCreator constructor(
    origin: String,
    occurredOn: LocalDateTime,
    user: String,
    private var documentId: UUID,
    private var retentionDate: LocalDateTime
) : AuditMetaData(UUID.randomUUID(), origin, occurredOn, user), AuditEvent {

    init {
        assertArgumentNotNull(documentId, "documentId is required")
        assertArgumentNotNull(retentionDate, "Retention date is required")
    }

    fun setDocumentId(documentId: UUID) {
        this.documentId = documentId
    }

    fun setRetentionDate(retentionDate: LocalDateTime) {
        this.retentionDate = retentionDate
    }

    @JsonView(AuditView.Internal::class)
    @JsonIgnore(false)
    override fun getDocumentId(): UUID = documentId

    @JsonProperty
    @JsonView(AuditView.Public::class)
    fun getRetentionDate(): LocalDateTime = retentionDate

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is DocumentRetentionPeriodSetEvent) return false
        if (!super.equals(other)) return false

        return retentionDate == other.retentionDate && documentId == other.documentId
    }

    override fun hashCode(): Int {
        return Objects.hash(super.hashCode(), retentionDate, documentId)
    }
}
