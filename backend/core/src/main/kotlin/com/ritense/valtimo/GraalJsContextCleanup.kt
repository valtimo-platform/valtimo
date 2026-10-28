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

import mu.KotlinLogging
import org.graalvm.polyglot.Context
import org.camunda.bpm.engine.impl.cfg.TransactionListener
import org.camunda.bpm.engine.impl.cfg.TransactionState
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import javax.script.Bindings
import org.camunda.bpm.engine.impl.context.Context as CamundaContext

object GraalJsContextCleanup {
    private val logger = KotlinLogging.logger {}
    private val RESOURCE_KEY = Any()

    private class Tracked(val bindings: Bindings, val ownContextOnly: Boolean)

    private class ThreadState {
        val pending = mutableListOf<Tracked>()
        var depth = 0
    }

    private val state = ThreadLocal<ThreadState>()

    fun track(bindings: Bindings, ownContextOnly: Boolean = false) {
        if (!registerDeferred(bindings, ownContextOnly)) {
            currentState().pending += Tracked(bindings, ownContextOnly)
        }
    }

    fun <T> closingAfter(block: () -> T): T {
        val current = currentState()
        current.depth++
        try {
            return block()
        } finally {
            current.depth--
            if (current.depth == 0) {
                val toClose = current.pending.toList()
                state.remove()
                toClose.forEach { close(it.bindings, it.ownContextOnly) }
            }
        }
    }

    internal fun pendingCount(): Int = state.get()?.pending?.size ?: 0

    private fun currentState(): ThreadState = state.get() ?: ThreadState().also { state.set(it) }

    /**
     * Schedules closing of the bindings after the surrounding transaction completes.
     * Returns false when there is no transaction to defer to and the caller must close after use.
     */
    fun registerDeferred(bindings: Bindings, ownContextOnly: Boolean = false): Boolean {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            registerWithSpring(Tracked(bindings, ownContextOnly))
            return true
        }
        val commandContext = CamundaContext.getCommandContext() ?: return false
        val listener = TransactionListener { close(bindings, ownContextOnly) }
        val transactionContext = commandContext.transactionContext
        transactionContext.addTransactionListener(TransactionState.COMMITTED, listener)
        transactionContext.addTransactionListener(TransactionState.ROLLED_BACK, listener)
        return true
    }

    fun close(bindings: Bindings, ownContextOnly: Boolean = false) {
        if (!ownContextOnly) {
            try {
                (bindings[POLYGLOT_CONTEXT] as? Context)?.close()
            } catch (e: Exception) {
                logger.warn(e) { "Failed to close GraalJS polyglot context" }
            }
        }
        try {
            (bindings as? AutoCloseable)?.close()
        } catch (e: Exception) {
            logger.warn(e) { "Failed to close GraalJS bindings" }
        }
    }

    private fun registerWithSpring(tracked: Tracked) {
        @Suppress("UNCHECKED_CAST")
        val existing = TransactionSynchronizationManager.getResource(RESOURCE_KEY) as? MutableList<Tracked>
        if (existing != null) {
            existing += tracked
            return
        }
        val holder = mutableListOf(tracked)
        TransactionSynchronizationManager.bindResource(RESOURCE_KEY, holder)
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun afterCompletion(status: Int) {
                TransactionSynchronizationManager.unbindResourceIfPossible(RESOURCE_KEY)
                holder.forEach { close(it.bindings, it.ownContextOnly) }
                holder.clear()
            }
        })
    }

    private const val POLYGLOT_CONTEXT = "polyglot.context"
}
