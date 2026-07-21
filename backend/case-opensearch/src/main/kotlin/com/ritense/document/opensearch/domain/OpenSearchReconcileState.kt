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

/**
 * Single-row persisted state for the OpenSearch reconciler: the [watermark] is the highest
 * `json_schema_document.changed_on` value that has been fully reconciled into OpenSearch. The next cycle
 * scans everything changed after (watermark − overlap). The watermark is advanced only after a completely
 * successful cycle, so an OpenSearch outage simply parks it until recovery.
 */
@Entity
@Table(name = "document_index_reconcile_state")
class OpenSearchReconcileState(

    @Id
    @Column(name = "id")
    val id: String = SINGLETON_ID,

    @Column(name = "watermark", nullable = false)
    var watermark: LocalDateTime,
) {
    companion object {
        /** There is only ever one reconcile-state row; this is its fixed primary key. */
        const val SINGLETON_ID = "SINGLETON"
    }
}
