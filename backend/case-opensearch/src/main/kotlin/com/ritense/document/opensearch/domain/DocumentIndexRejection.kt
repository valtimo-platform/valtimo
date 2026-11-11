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

package com.ritense.document.opensearch.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

/**
 * A case that OpenSearch refused to index. While a row exists for a definition, its case lists are read from
 * PostgreSQL; the reconciler retries the case and removes the row once it is indexed or deleted.
 */
@Entity
@Table(name = "document_index_rejection")
class DocumentIndexRejection(

    @Id
    @Column(name = "document_id")
    val documentId: UUID,

    @Column(name = "definition_name", nullable = false)
    var definitionName: String,

    @Column(name = "first_rejected_on", nullable = false)
    val firstRejectedOn: LocalDateTime,

    @Column(name = "last_rejected_on", nullable = false)
    var lastRejectedOn: LocalDateTime = firstRejectedOn,

    @Column(name = "attempts", nullable = false)
    var attempts: Int = 1,

    @Column(name = "next_retry_on", nullable = false)
    var nextRetryOn: LocalDateTime,
) {
    fun rejectedAgain(definitionName: String, now: LocalDateTime, nextRetryOn: LocalDateTime) {
        this.definitionName = definitionName
        this.lastRejectedOn = now
        this.attempts++
        this.nextRetryOn = nextRetryOn
    }
}
