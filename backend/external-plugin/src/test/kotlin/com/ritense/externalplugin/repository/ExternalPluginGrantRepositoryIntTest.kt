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

package com.ritense.externalplugin.repository

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginCapability
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Structural guarantees of the grant tables (plan §5) against a real database — neither the unique
 * constraints nor the capability column's wire form can be verified with a mocked repository:
 *
 * - each grant table has a DB unique constraint on its natural key, so duplicate grants are
 *   impossible even if a caller asks for them;
 * - the `ExternalPluginCapability` converter stores the lowercase manifest/protocol identifier, which
 *   is what the host receives on a config push and matches against a plugin's declaration;
 * - the security-hardening and event-queue columns round-trip.
 *
 * Runs on Postgres **and** MySQL (`integrationTesting{Postgresql,Mysql}`) because both are supported
 * and `ddl-auto` is `none`, so any drift between the Liquibase changelogs and the entities fails here.
 */
@Transactional
class ExternalPluginGrantRepositoryIntTest @Autowired constructor(
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    private fun seedConfiguration(): ExternalPluginConfiguration {
        val host = hostRepository.saveAndFlush(
            ExternalPluginHost(
                id = UUID.randomUUID(),
                name = "host-${UUID.randomUUID()}",
                baseUrl = "https://plugin-host:8090",
                secret = "encrypted-secret",
                status = ExternalPluginHostStatus.CONNECTED,
                kind = ExternalPluginHostKind.PLUGIN_HOST,
                gzacCallbackBaseUrl = "http://gzac:8080",
                eventBrokerAmqpUrl = "amqp://guest:guest@rabbit:5672",
                eventBrokerExchange = "valtimo-events",
                eventQueueMode = EventQueueMode.DURABLE,
                eventQueueTtlMs = 259_200_000,
            )
        )
        val definition = definitionRepository.saveAndFlush(
            ExternalPluginDefinition(
                id = UUID.randomUUID(),
                pluginId = "case-summary-${UUID.randomUUID()}",
                version = "0.1.0",
                name = "Case Summary",
                description = "Shows a summary",
                provider = "Ritense",
                minGzacVersion = "12.0.0",
                maxGzacVersion = "12.1.0",
                manifestJson = objectMapper.createObjectNode().put("pluginId", "case-summary"),
                hostId = host.id,
                baseUrl = "${host.baseUrl}/plugins/case-summary",
                status = ExternalPluginDefinitionStatus.AVAILABLE,
                contentHash = "sha256:accepted",
                pendingContentHash = "sha256:changed",
            )
        )
        return configurationRepository.saveAndFlush(
            ExternalPluginConfiguration(
                id = UUID.randomUUID(),
                definitionId = definition.id,
                title = "My configuration",
                properties = objectMapper.createObjectNode().put("apiUrl", "https://example.com"),
                tokenGeneration = 4,
            )
        )
    }

    private fun endpoint(configurationId: UUID, method: String, pattern: String) =
        ExternalPluginGrantedEndpoint(
            id = UUID.randomUUID(),
            configurationId = configurationId,
            httpMethod = method,
            endpointPattern = pattern,
        )

    // ---------------------------------------------------------------- unique constraints

    @Test
    fun `a duplicate endpoint grant is rejected by the database`() {
        val configuration = seedConfiguration()
        grantedEndpointRepository.saveAndFlush(
            endpoint(configuration.id, "GET", "/api/v1/document/*")
        )

        assertThatThrownBy {
            grantedEndpointRepository.saveAndFlush(
                endpoint(configuration.id, "GET", "/api/v1/document/*")
            )
        }.isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `the same pattern under a different method is a distinct grant`() {
        val configuration = seedConfiguration()
        grantedEndpointRepository.saveAndFlush(endpoint(configuration.id, "GET", "/api/v1/document/*"))

        assertThatCode {
            grantedEndpointRepository.saveAndFlush(
                endpoint(configuration.id, "POST", "/api/v1/document/*")
            )
        }.doesNotThrowAnyException()

        assertThat(grantedEndpointRepository.findAllByConfigurationId(configuration.id)).hasSize(2)
    }

    @Test
    fun `a duplicate event grant is rejected by the database`() {
        val configuration = seedConfiguration()
        grantedEventRepository.saveAndFlush(
            ExternalPluginGrantedEvent(
                id = UUID.randomUUID(),
                configurationId = configuration.id,
                eventType = "com.ritense.valtimo.document.created",
            )
        )

        assertThatThrownBy {
            grantedEventRepository.saveAndFlush(
                ExternalPluginGrantedEvent(
                    id = UUID.randomUUID(),
                    configurationId = configuration.id,
                    eventType = "com.ritense.valtimo.document.created",
                )
            )
        }.isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `a duplicate capability grant is rejected by the database`() {
        val configuration = seedConfiguration()
        grantedCapabilityRepository.saveAndFlush(
            ExternalPluginGrantedCapability(
                id = UUID.randomUUID(),
                configurationId = configuration.id,
                capability = ExternalPluginCapability.GZAC_API,
            )
        )

        assertThatThrownBy {
            grantedCapabilityRepository.saveAndFlush(
                ExternalPluginGrantedCapability(
                    id = UUID.randomUUID(),
                    configurationId = configuration.id,
                    capability = ExternalPluginCapability.GZAC_API,
                )
            )
        }.isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun `two configurations may hold the same grants`() {
        val first = seedConfiguration()
        val second = seedConfiguration()

        grantedEndpointRepository.saveAndFlush(endpoint(first.id, "GET", "/api/v1/document/*"))

        assertThatCode {
            grantedEndpointRepository.saveAndFlush(endpoint(second.id, "GET", "/api/v1/document/*"))
        }.doesNotThrowAnyException()
    }

    // ---------------------------------------------------------------- replace-on-write

    @Test
    fun `replacing an overlapping endpoint grant set succeeds because the delete is flushed first`() {
        // Hibernate orders inserts ahead of deletes inside one flush, so re-inserting an overlapping
        // grant without an explicit flush would trip the unique constraint (§5). This reproduces the
        // exact sequence ExternalPluginConfigurationService.update performs.
        val configuration = seedConfiguration()
        grantedEndpointRepository.saveAllAndFlush(
            listOf(
                endpoint(configuration.id, "GET", "/api/v1/document/*"),
                endpoint(configuration.id, "POST", "/api/v1/document/*/note"),
            )
        )

        grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
        grantedEndpointRepository.flush()
        grantedEndpointRepository.saveAllAndFlush(
            listOf(
                // Overlaps the previous set — the risky case.
                endpoint(configuration.id, "GET", "/api/v1/document/*"),
                endpoint(configuration.id, "POST", "/api/v1/case/*/search"),
            )
        )

        assertThat(
            grantedEndpointRepository.findAllByConfigurationId(configuration.id)
                .map { it.httpMethod to it.endpointPattern }
        ).containsExactlyInAnyOrder(
            "GET" to "/api/v1/document/*",
            "POST" to "/api/v1/case/*/search",
        )
    }

    // ---------------------------------------------------------------- capability column form

    @Test
    fun `the capability converter stores the lowercase wire value, not the enum name`() {
        val configuration = seedConfiguration()
        ExternalPluginCapability.entries.forEach { capability ->
            grantedCapabilityRepository.save(
                ExternalPluginGrantedCapability(
                    id = UUID.randomUUID(),
                    configurationId = configuration.id,
                    capability = capability,
                )
            )
        }
        grantedCapabilityRepository.flush()
        entityManager.clear()

        // Read the raw column: the host protocol and the manifest both use these identifiers, so the
        // stored form has to match them exactly (§18.2).
        @Suppress("UNCHECKED_CAST")
        val stored = entityManager
            .createNativeQuery("SELECT capability FROM external_plugin_granted_capability")
            .resultList as List<Any>

        assertThat(stored.map { it.toString() })
            .containsExactlyInAnyOrderElementsOf(ExternalPluginCapability.entries.map { it.value })
        assertThat(stored.map { it.toString() }).contains("gzac_api", "http_request", "kv", "log", "frontend_data")
    }

    @Test
    fun `capability grants read back as typed values`() {
        val configuration = seedConfiguration()
        grantedCapabilityRepository.saveAndFlush(
            ExternalPluginGrantedCapability(
                id = UUID.randomUUID(),
                configurationId = configuration.id,
                capability = ExternalPluginCapability.FRONTEND_DATA,
            )
        )
        entityManager.clear()

        assertThat(grantedCapabilityRepository.findAllByConfigurationId(configuration.id).map { it.capability })
            .containsExactly(ExternalPluginCapability.FRONTEND_DATA)
    }

    // ---------------------------------------------------------------- hardening columns

    @Test
    fun `the content-pinning columns round-trip`() {
        val configuration = seedConfiguration()
        entityManager.clear()

        val definition = definitionRepository.findById(configuration.definitionId).orElseThrow()

        assertThat(definition.contentHash).isEqualTo("sha256:accepted")
        assertThat(definition.pendingContentHash).isEqualTo("sha256:changed")
        assertThat(definition.requiresReacceptance).isTrue()
        assertThat(definition.minGzacVersion).isEqualTo("12.0.0")
        assertThat(definition.maxGzacVersion).isEqualTo("12.1.0")
    }

    @Test
    fun `the token generation counter round-trips`() {
        val configuration = seedConfiguration()
        entityManager.clear()

        assertThat(configurationRepository.findById(configuration.id).orElseThrow().tokenGeneration)
            .isEqualTo(4)
    }

    @Test
    fun `the host kind and event-queue columns round-trip`() {
        val configuration = seedConfiguration()
        val definition = definitionRepository.findById(configuration.definitionId).orElseThrow()
        entityManager.clear()

        val host = hostRepository.findById(definition.hostId).orElseThrow()

        assertThat(host.kind).isEqualTo(ExternalPluginHostKind.PLUGIN_HOST)
        assertThat(host.eventQueueMode).isEqualTo(EventQueueMode.DURABLE)
        assertThat(host.eventQueueTtlMs).isEqualTo(259_200_000)
        assertThat(host.eventBrokerExchange).isEqualTo("valtimo-events")
    }
}
