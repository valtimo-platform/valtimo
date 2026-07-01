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

package com.ritense.document.opensearch.handler

import com.ritense.document.event.DocumentAssigned
import com.ritense.document.event.DocumentCreated
import com.ritense.document.event.DocumentDeleted
import com.ritense.document.event.DocumentRetentionDateSet
import com.ritense.document.event.DocumentRetentionDateUnset
import com.ritense.document.event.DocumentStatusChanged
import com.ritense.document.event.DocumentTagsChanged
import com.ritense.document.event.DocumentUnassigned
import com.ritense.document.event.DocumentUpdated
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import org.springframework.context.event.EventListener

class DocumentOpenSearchEventListener(
    private val syncService: DocumentOpenSearchSyncService,
) {
    @EventListener
    fun onDocumentCreated(event: DocumentCreated) = syncService.upsert(event)

    @EventListener
    fun onDocumentUpdated(event: DocumentUpdated) = syncService.upsert(event)

    @EventListener
    fun onDocumentAssigned(event: DocumentAssigned) = syncService.upsert(event)

    @EventListener
    fun onDocumentUnassigned(event: DocumentUnassigned) = syncService.upsert(event)

    @EventListener
    fun onDocumentStatusChanged(event: DocumentStatusChanged) = syncService.upsert(event)

    @EventListener
    fun onDocumentTagsChanged(event: DocumentTagsChanged) = syncService.upsert(event)

    @EventListener
    fun onDocumentRetentionDateSet(event: DocumentRetentionDateSet) = syncService.upsert(event)

    @EventListener
    fun onDocumentRetentionDateUnset(event: DocumentRetentionDateUnset) = syncService.upsert(event)

    @EventListener
    fun onDocumentDeleted(event: DocumentDeleted) {
        event.resultId?.let { syncService.delete(it) }
    }
}
