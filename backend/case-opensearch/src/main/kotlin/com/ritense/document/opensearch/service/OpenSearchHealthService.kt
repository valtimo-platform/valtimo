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

import com.ritense.document.opensearch.OpenSearchProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.RequestOptions
import org.opensearch.client.RestHighLevelClient

class OpenSearchHealthService(
    private val restHighLevelClient: RestHighLevelClient,
    private val toggle: SearchEngineToggle,
    private val properties: OpenSearchProperties,
) {

    fun checkAndRecover() {
        if (!toggle.isFallbackActive()) {
            return
        }

        val available = try {
            restHighLevelClient.ping(RequestOptions.DEFAULT)
        } catch (_: Exception) {
            false
        }

        if (available) {
            logger.info { "OpenSearch is available again, deactivating fallback" }
            toggle.deactivateFallback()
        } else {
            logFallbackWarningIfNeeded()
        }
    }

    private fun logFallbackWarningIfNeeded() {
        if (toggle.shouldLogWarning(properties.fallbackWarningIntervalMs)) {
            logger.warn { "OpenSearch unavailable, using PostgreSQL fallback" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
