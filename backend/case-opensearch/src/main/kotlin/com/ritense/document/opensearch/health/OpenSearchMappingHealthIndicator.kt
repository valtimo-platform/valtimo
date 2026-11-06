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

package com.ritense.document.opensearch.health

import com.ritense.document.opensearch.service.DocumentOpenSearchIndexInitializer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.actuate.health.AbstractHealthIndicator
import org.springframework.boot.actuate.health.Health
import org.springframework.boot.actuate.health.Status

/**
 * Surfaces, via `/actuator/health`, whether the OpenSearch document-search topology is legacy or stale and a
 * rebuild/migration is required (see [DocumentOpenSearchIndexInitializer.isLegacyOrStale]).
 *
 * Reports a non-fatal [WARN] status rather than DOWN so a legacy topology does not take the application out of
 * service — the index still serves results until the operator runs the migrate re-index. An error while
 * probing (e.g. OpenSearch unreachable) is reported UP with an informational detail so this indicator never
 * destabilises the overall health on a transient cluster blip.
 *
 * Only active when spring-boot-starter-actuator is on the classpath.
 */
class OpenSearchMappingHealthIndicator(
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
) : AbstractHealthIndicator() {

    override fun doHealthCheck(builder: Health.Builder) {
        val legacyOrStale = try {
            indexInitializer.isLegacyOrStale()
        } catch (e: Exception) {
            logger.debug(e) { "Could not determine OpenSearch topology status for health check" }
            builder.up().withDetail("topology", "UNKNOWN")
            return
        }

        if (legacyOrStale) {
            builder.status(WARN)
                .withDetail("topology", "LEGACY_OR_STALE")
                .withDetail("action", "Run the document-search re-index with recreateIndex to migrate to per-definition indices")
        } else {
            builder.up().withDetail("topology", "PER_DEFINITION")
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val WARN = Status("WARN", "A document-search index rebuild/migration is required")
    }
}
