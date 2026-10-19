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

package com.ritense.document.opensearch.handler

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.document.domain.event.DocumentDefinitionDeployedEvent
import com.ritense.document.opensearch.service.DocumentOpenSearchIndexInitializer
import com.ritense.document.opensearch.service.SearchEngineToggle
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Transactional

/**
 * Provisions a per-definition OpenSearch index (and joins it to the shared read alias) the moment a new case
 * definition is deployed, so a definition gets its index before its first document is written — not only at
 * the startup/switch-on sweep. No-op while OpenSearch is not the active engine; the startup
 * [DocumentOpenSearchIndexInitializer.ensureAllIndices] sweep then covers it once OpenSearch is enabled.
 */
open class DocumentDefinitionDeployedIndexListener(
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
    private val toggle: SearchEngineToggle,
) {
    @Transactional
    @RunWithoutAuthorization
    @EventListener(DocumentDefinitionDeployedEvent::class)
    open fun createIndex(event: DocumentDefinitionDeployedEvent) {
        if (!toggle.isOpenSearchActive()) return
        val definitionKey = event.documentDefinition().id().name()
        try {
            indexInitializer.ensureIndex(definitionKey)
        } catch (e: Exception) {
            logger.warn(e) { "Failed to create OpenSearch index for deployed definition '$definitionKey' — the reconciler/reindex will repair it" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
