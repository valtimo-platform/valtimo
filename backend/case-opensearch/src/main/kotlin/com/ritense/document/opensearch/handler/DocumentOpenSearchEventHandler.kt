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
import com.ritense.document.event.DocumentUnassigned
import com.ritense.document.event.DocumentUpdated
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import com.ritense.inbox.ValtimoEvent
import com.ritense.inbox.ValtimoEventHandler
import io.github.oshai.kotlinlogging.KotlinLogging

/**
 * Listens to document domain events from the Valtimo inbox and keeps the OpenSearch read
 * model in sync. Works with both the outbox-enabled (RabbitMQ) and outbox-disabled
 * (local Spring event) modes because both paths converge on [ValtimoEventHandler].
 */
class DocumentOpenSearchEventHandler(
    private val syncService: DocumentOpenSearchSyncService,
) : ValtimoEventHandler {

    override fun handle(event: ValtimoEvent) {
        when (event.type) {
            in UPSERT_EVENT_TYPES -> syncService.upsert(event)
            DELETED_EVENT_TYPE -> {
                val id = event.resultId
                if (id != null) {
                    syncService.delete(id)
                } else {
                    logger.warn { "Received DocumentDeleted event with null resultId — skipping delete" }
                }
            }
            else -> {
                // Events not related to json_schema_document (e.g. DocumentsListed) are ignored
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        val UPSERT_EVENT_TYPES: Set<String> = setOf(
            DocumentCreated.TYPE,
            DocumentUpdated.TYPE,
            DocumentAssigned.TYPE,
            DocumentUnassigned.TYPE,
            "com.ritense.valtimo.document.status.changed",
            "com.ritense.valtimo.document.tags.changed",
            "com.ritense.valtimo.document.retentiondate.set",
            "com.ritense.valtimo.document.retentiondate.unset",
        )

        const val DELETED_EVENT_TYPE = "com.ritense.valtimo.document.deleted"
    }
}
