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
import com.ritense.document.opensearch.service.TopologyGate
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.actuate.health.AbstractHealthIndicator
import org.springframework.boot.actuate.health.Health
import org.springframework.boot.actuate.health.Status

/**
 * Surfaces, via `/actuator/health`, whether OpenSearch can serve document search completely (see [TopologyGate]):
 * a legacy or stale topology that needs the migrate reindex, a reconciler still catching up, case types with
 * rejected cases, or a recent rejected write.
 *
 * Reports a non-fatal [WARN] status rather than DOWN so it never takes the application out of service — search
 * falls back to PostgreSQL meanwhile. Spring Boot ignores statuses missing from
 * `management.endpoint.health.status.order`, so the aggregate only reflects WARN when it is listed there. An error
 * while probing (e.g. OpenSearch unreachable) is reported UP with an informational detail so this indicator never
 * destabilises the overall health on a transient cluster blip.
 *
 * Only active when spring-boot-starter-actuator is on the classpath.
 */
class OpenSearchMappingHealthIndicator(
    private val topologyGate: TopologyGate,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
) : AbstractHealthIndicator() {

    override fun doHealthCheck(builder: Health.Builder) {
        val snapshot = try {
            topologyGate.snapshot()
        } catch (e: Exception) {
            logger.debug(e) { "Could not determine OpenSearch topology status for health check" }
            builder.up().withDetail("topology", "UNKNOWN")
            return
        }

        when {
            snapshot.legacyOrStale -> builder.status(WARN)
                .withDetail("topology", "LEGACY_OR_STALE")
                .withDetail("action", "Run the document-search re-index with recreateIndex to migrate to per-definition indices")
            snapshot.catchingUp -> builder.status(WARN)
                .withDetail("topology", "PER_DEFINITION")
                .withDetail("indexing", "CATCHING_UP")
                .withDetail("action", "None — search uses PostgreSQL until the reconciler has indexed every case")
            snapshot.rejectedDefinitions.isNotEmpty() -> builder.status(WARN)
                .withDetail("topology", "PER_DEFINITION")
                .withDetail("rejectedDefinitions", snapshot.rejectedDefinitions.sorted())
                .withDetail("action", "OpenSearch rejected cases of these case types, which are searched in PostgreSQL meanwhile — check the logs")
            indexInitializer.hasRecentWriteFailures() -> builder.status(WARN)
                .withDetail("topology", "PER_DEFINITION")
                .withDetail("writeFailures", "RECENT")
                .withDetail("action", "A document could not be indexed — check the logs")
            else -> builder.up().withDetail("topology", "PER_DEFINITION")
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val WARN = Status("WARN", "OpenSearch cannot serve document search completely")
    }
}
