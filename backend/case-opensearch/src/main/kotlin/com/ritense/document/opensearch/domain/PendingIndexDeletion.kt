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
 * Durable record that a document was deleted from PostgreSQL and its OpenSearch entry still has to be
 * removed.
 *
 * Written **inside** the deleting transaction (see
 * [com.ritense.document.opensearch.handler.PendingIndexDeletionListener]) so it commits atomically with
 * the delete — surviving an OpenSearch outage of any length. The reconciler drains these rows at
 * O(deletes): remove each id from the index, then delete the drained rows. Idempotent.
 */
@Entity
@Table(name = "document_index_pending_deletion")
class PendingIndexDeletion(

    @Id
    @Column(name = "document_id")
    val documentId: UUID,

    @Column(name = "deleted_on", nullable = false)
    val deletedOn: LocalDateTime = LocalDateTime.now(),
)
