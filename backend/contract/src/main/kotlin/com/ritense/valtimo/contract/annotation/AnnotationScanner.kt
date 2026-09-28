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

package com.ritense.valtimo.contract.annotation

import io.github.classgraph.ClassGraph
import io.github.classgraph.ScanResult
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.ApplicationContext
import org.springframework.context.event.EventListener
import org.springframework.core.Ordered.LOWEST_PRECEDENCE
import org.springframework.core.annotation.Order

/**
 * The one ClassGraph scan an application context needs. Every [AnnotatedClassResolver] in the context queries
 * it instead of scanning itself.
 *
 * Thread count: `valtimo.annotation-scan.threads`. Released once the application is ready and at shutdown.
 */
open class AnnotationScanner(
    private val context: ApplicationContext
) : AutoCloseable {

    private val lock = Any()

    private var scannedPackages: List<String>? = null

    private var scanResult: ScanResult? = null

    /** Same lock as [close], so the result cannot be closed while [block] reads it. */
    fun <T> withScanResult(acceptPackages: Array<String>, block: (ScanResult) -> T): T {
        synchronized(lock) {
            return block(getScanResult(acceptPackages))
        }
    }

    /** Rebuilds when closed or when [acceptPackages] differs — never hands out a result to the wrong question. */
    internal fun getScanResult(acceptPackages: Array<String>): ScanResult {
        val packages = acceptPackages.toList()
        synchronized(lock) {
            val cached = scanResult
            if (cached != null && !cached.isClosed && scannedPackages == packages) {
                return cached
            }
            cached?.close()
            return scan(acceptPackages).also {
                scanResult = it
                scannedPackages = packages
            }
        }
    }

    protected open fun scan(acceptPackages: Array<String>): ScanResult {
        val startedAt = System.nanoTime()
        val classGraph = ClassGraph()
            .acceptPackages(*acceptPackages)
            .enableClassInfo()
            .enableMethodInfo()
            .enableAnnotationInfo()

        val threads = getScanThreads()
        val result = if (threads == null) classGraph.scan() else classGraph.scan(threads)

        logger.debug {
            "ClassGraph scan of ${acceptPackages.joinToString()} took " +
                "${(System.nanoTime() - startedAt) / 1_000_000}ms, ${result.allClasses.size} classes"
        }
        return result
    }

    /**
     * Nothing scans after startup — resolvers build their maps during refresh, plugin deployment reads at
     * `ApplicationStartedEvent`. Keeping the result would retain the class metadata for the whole run.
     * Ordered last so a scan from another ready listener still hits the shared result.
     */
    @Order(LOWEST_PRECEDENCE)
    @EventListener(ApplicationReadyEvent::class)
    fun releaseAfterStartup() {
        close()
    }

    override fun close() {
        synchronized(lock) {
            scanResult?.close()
            scanResult = null
            scannedPackages = null
        }
    }

    /** Null: let ClassGraph pick, which scales with the cores. A CPU-constrained container can pin it to 1. */
    private fun getScanThreads(): Int? {
        val configured = context.environment.getProperty(SCAN_THREADS_PROPERTY)?.trim() ?: return null
        val threads = configured.toIntOrNull()
        return if (threads != null && threads >= 1) {
            threads
        } else {
            logger.warn { "Ignoring $SCAN_THREADS_PROPERTY=$configured, scanning with the default thread count" }
            null
        }
    }

    companion object {
        const val SCAN_THREADS_PROPERTY = "valtimo.annotation-scan.threads"

        private val logger = KotlinLogging.logger {}
    }
}
