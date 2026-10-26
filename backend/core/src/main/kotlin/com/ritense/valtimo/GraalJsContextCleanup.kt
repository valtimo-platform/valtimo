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

package com.ritense.valtimo

import io.github.oshai.kotlinlogging.KotlinLogging
import org.graalvm.polyglot.Context
import org.operaton.bpm.engine.impl.cfg.TransactionListener
import org.operaton.bpm.engine.impl.cfg.TransactionState
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import javax.script.Bindings
import org.operaton.bpm.engine.impl.context.Context as OperatonContext

object GraalJsContextCleanup {
    private val logger = KotlinLogging.logger {}
    private val RESOURCE_KEY = Any()

    /**
     * Schedules closing of the bindings after the surrounding transaction completes.
     * Returns false when there is no transaction to defer to and the caller must close after use.
     */
    fun registerDeferred(bindings: Bindings): Boolean {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            registerWithSpring(bindings)
            return true
        }
        val commandContext = OperatonContext.getCommandContext() ?: return false
        val listener = TransactionListener { close(bindings) }
        val transactionContext = commandContext.transactionContext
        transactionContext.addTransactionListener(TransactionState.COMMITTED, listener)
        transactionContext.addTransactionListener(TransactionState.ROLLED_BACK, listener)
        return true
    }

    fun close(bindings: Bindings) {
        try {
            (bindings[POLYGLOT_CONTEXT] as? Context)?.close()
        } catch (e: Exception) {
            logger.warn(e) { "Failed to close GraalJS polyglot context" }
        }
        try {
            (bindings as? AutoCloseable)?.close()
        } catch (e: Exception) {
            logger.warn(e) { "Failed to close GraalJS bindings" }
        }
    }

    private fun registerWithSpring(bindings: Bindings) {
        @Suppress("UNCHECKED_CAST")
        val existing = TransactionSynchronizationManager.getResource(RESOURCE_KEY) as? MutableList<Bindings>
        if (existing != null) {
            existing += bindings
            return
        }
        val holder = mutableListOf(bindings)
        TransactionSynchronizationManager.bindResource(RESOURCE_KEY, holder)
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun afterCompletion(status: Int) {
                TransactionSynchronizationManager.unbindResourceIfPossible(RESOURCE_KEY)
                holder.forEach { close(it) }
                holder.clear()
            }
        })
    }

    private const val POLYGLOT_CONTEXT = "polyglot.context"
}
