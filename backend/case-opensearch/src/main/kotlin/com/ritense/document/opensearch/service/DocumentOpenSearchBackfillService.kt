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

package com.ritense.document.opensearch.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.EntityManager
import org.opensearch.client.RequestOptions
import org.opensearch.client.RestHighLevelClient
import org.opensearch.common.settings.Settings
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

open class DocumentOpenSearchBackfillService(
    private val entityManager: EntityManager,
    private val openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
    private val objectMapper: ObjectMapper,
    private val restHighLevelClient: RestHighLevelClient,
    private val transactionManager: PlatformTransactionManager,
) {

    private val running = AtomicBoolean(false)
    private val migratedCount = AtomicLong(0)
    private val startTimeMillis = AtomicLong(0)
    private val lastError = AtomicReference<String?>(null)

    fun start(pageSize: Int = DEFAULT_PAGE_SIZE): Boolean {
        if (!running.compareAndSet(false, true)) return false
        migratedCount.set(0)
        startTimeMillis.set(System.currentTimeMillis())
        lastError.set(null)

        Thread.startVirtualThread {
            try {
                backfill(pageSize)
            } catch (e: Exception) {
                lastError.set(e.message)
                logger.error(e) { "Backfill failed" }
            } finally {
                running.set(false)
            }
        }
        return true
    }

    fun status(): Map<String, Any?> {
        val isRunning = running.get()
        val count = migratedCount.get()
        val elapsed = if (startTimeMillis.get() > 0) {
            (System.currentTimeMillis() - startTimeMillis.get()) / 1000
        } else 0L

        return mapOf(
            "running" to isRunning,
            "migratedCount" to count,
            "elapsedSeconds" to elapsed,
            "error" to lastError.get(),
        )
    }

    /**
     * Copies all existing [JsonSchemaDocument] rows from the relational database to OpenSearch.
     * Uses keyset (cursor) pagination on the primary key to avoid offset-based scans, and clears
     * the persistence context after every batch to prevent memory buildup.
     *
     * Each batch runs in its own short-lived read-only transaction to avoid long-lived
     * transaction snapshots that would prevent PostgreSQL vacuum from reclaiming space.
     */
    open fun backfill(pageSize: Int = DEFAULT_PAGE_SIZE): Long {
        setRefreshInterval("-1")

        var lastId: UUID? = null
        var total = 0L
        val startTime = System.currentTimeMillis()
        val txTemplate = TransactionTemplate(transactionManager).apply { isReadOnly = true }

        try {
            while (true) {
                val batch = txTemplate.execute {
                    val result = fetchBatch(lastId, pageSize)
                    entityManager.clear()
                    result
                } ?: break
                if (batch.isEmpty()) break

                val docs = mutableListOf<JsonSchemaDocumentOsDocument>()
                for (jpaDoc in batch) {
                    try {
                        val tree = objectMapper.valueToTree<com.fasterxml.jackson.databind.JsonNode>(jpaDoc)
                        val doc = objectMapper.treeToValue(tree, JsonSchemaDocumentOsDocument::class.java)
                        docs.add(doc.copy(contentText = extractLeafValues(tree.get("content"))))
                    } catch (e: Exception) {
                        logger.warn(e) { "Failed to convert document — skipping" }
                    }
                }
                openSearchRepository.saveAll(docs)
                total += docs.size
                migratedCount.set(total)
                lastId = batch.last().id().id

                if (total % LOG_INTERVAL == 0L) {
                    val elapsed = (System.currentTimeMillis() - startTime) / 1000
                    logger.info { "Backfill progress: $total documents indexed (${elapsed}s elapsed)" }
                }
            }
        } finally {
            setRefreshInterval("1s")
        }

        val elapsed = (System.currentTimeMillis() - startTime) / 1000
        logger.info { "Backfill complete: $total documents migrated to OpenSearch in ${elapsed}s" }
        return total
    }

    private fun fetchBatch(lastId: UUID?, pageSize: Int): List<JsonSchemaDocument> {
        val query = if (lastId == null) {
            entityManager.createQuery(
                "SELECT d FROM JsonSchemaDocument d ORDER BY d.id.id",
                JsonSchemaDocument::class.java
            )
        } else {
            entityManager.createQuery(
                "SELECT d FROM JsonSchemaDocument d WHERE d.id.id > :lastId ORDER BY d.id.id",
                JsonSchemaDocument::class.java
            ).setParameter("lastId", lastId)
        }
        return query.setMaxResults(pageSize).resultList
    }

    private fun setRefreshInterval(interval: String) {
        try {
            val request = org.opensearch.action.admin.indices.settings.put.UpdateSettingsRequest(INDEX_NAME)
            request.settings(Settings.builder().put("index.refresh_interval", interval))
            restHighLevelClient.indices().putSettings(request, RequestOptions.DEFAULT)
            logger.debug { "Set index refresh_interval to $interval" }
        } catch (e: Exception) {
            logger.warn(e) { "Failed to set refresh_interval to $interval — continuing" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val INDEX_NAME = "json_schema_document"
        const val DEFAULT_PAGE_SIZE = 5000
        private const val LOG_INTERVAL = 50_000L
    }
}
