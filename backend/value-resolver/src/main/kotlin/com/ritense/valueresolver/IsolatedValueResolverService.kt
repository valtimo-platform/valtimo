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

package com.ritense.valueresolver

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate

/**
 * Resolves list-column values in a transaction isolated from the caller's, so a resolver that poisons the
 * read-only page transaction (marking it rollback-only) can no longer fail the whole search. A whole page is
 * resolved in one new read-only transaction; only when that transaction is poisoned does it fall back to
 * resolving each document in its own new transaction, so the cost scales with failures, not page size.
 */
class IsolatedValueResolverService(
    transactionManager: PlatformTransactionManager,
    private val valueResolverService: ValueResolverService,
) {

    private val newReadOnlyTx = TransactionTemplate(transactionManager).apply {
        propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
        isReadOnly = true
    }

    fun resolveValuesOrNullIsolated(documentPaths: Map<String, List<String>>): Map<String, ValueResolverResult> =
        try {
            newReadOnlyTx.execute {
                documentPaths.mapValues { (documentId, paths) ->
                    valueResolverService.resolveValuesOrNullWithFailures(documentId, paths)
                }
            }!!
        } catch (e: Exception) {
            logger.warn { "Column resolution poisoned the page transaction; retrying per row. ${e.message}" }
            documentPaths.mapValues { (documentId, paths) -> resolveRow(documentId, paths) }
        }

    private fun resolveRow(documentId: String, paths: List<String>): ValueResolverResult =
        try {
            newReadOnlyTx.execute { valueResolverService.resolveValuesOrNullWithFailures(documentId, paths) }!!
        } catch (e: Exception) {
            logger.warn { "Column resolution failed for document $documentId; columns resolved to null. ${e.message}" }
            ValueResolverResult(paths.associateWith { null }, paths.toSet())
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
