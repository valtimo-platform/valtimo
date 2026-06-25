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

package com.ritense.externalplugin.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.externalplugin.compatibility.CompatibilityResult
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.EndpointQuery
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.ConfigurationCreateRequest
import com.ritense.externalplugin.web.rest.dto.ConfigurationDetailResponse
import com.ritense.externalplugin.web.rest.dto.ConfigurationResponse
import com.ritense.externalplugin.web.rest.dto.ConfigurationUpdateRequest
import com.ritense.externalplugin.web.rest.dto.DefinitionResponse
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointResponse
import com.ritense.externalplugin.web.rest.dto.GrantedEventResponse
import com.ritense.externalplugin.web.rest.dto.HostCreateRequest
import com.ritense.externalplugin.web.rest.dto.HostDefaultsResponse
import com.ritense.externalplugin.web.rest.dto.HostEventQueueUpdateRequest
import com.ritense.externalplugin.web.rest.dto.HostResponse
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.core.env.Environment
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@Controller
@SkipComponentScan
@RequestMapping("/api/management/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginManagementResource(
    private val hostService: ExternalPluginHostService,
    private val definitionService: ExternalPluginDefinitionService,
    private val configurationService: ExternalPluginConfigurationService,
    private val endpointDescriptionService: EndpointDescriptionService,
    private val discoveryService: ExternalPluginDiscoveryService,
    private val environment: Environment,
    private val compatibilityChecker: GzacCompatibilityChecker,
    private val pluginPackageInspector: PluginPackageInspector,
    private val objectMapper: ObjectMapper,
) {

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List external plugin hosts",
        nl = "Externe-pluginhosts ophalen",
    )
    @GetMapping("/host")
    fun listHosts(): ResponseEntity<List<HostResponse>> =
        ResponseEntity.ok(hostService.list().map(HostResponse::from))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Register an external plugin host",
        nl = "Externe-pluginhost registreren",
    )
    @PostMapping("/host")
    fun createHost(@RequestBody request: HostCreateRequest): ResponseEntity<HostResponse> {
        val host = hostService.register(
            request.name,
            request.baseUrl,
            request.secret,
            request.gzacCallbackBaseUrl,
            request.eventBrokerAmqpUrl,
            request.eventBrokerExchange,
            request.eventQueueMode,
            request.eventQueueTtlMs,
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(HostResponse.from(host))
    }

    /**
     * Narrowly-scoped update for the per-host event-queue declaration. baseUrl/secret/broker stay
     * immutable; only mode and TTL are mutable. Triggers an immediate re-discovery so the host's
     * `EventConsumerManager` swaps its queue without waiting for the next polling tick — best-effort
     * because the periodic discovery cycle will reconcile anyway.
     */
    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update a host's event-queue mode and TTL",
        nl = "Event-queue-modus en TTL van host bijwerken",
    )
    @PatchMapping("/host/{hostId}/event-queue")
    fun updateHostEventQueue(
        @PathVariable hostId: UUID,
        @RequestBody request: HostEventQueueUpdateRequest,
    ): ResponseEntity<HostResponse> {
        val host = hostService.updateEventQueue(
            hostId,
            request.eventQueueMode,
            request.eventQueueTtlMs,
        )
        runCatching { discoveryService.discoverAll() }
        return ResponseEntity.ok(HostResponse.from(host))
    }

    /**
     * Suggested defaults for the add-host form, derived from existing system state so no env vars
     * are required:
     * - GZAC callback URL: `http://localhost:{server.port}` — the backend's own port. We deliberately
     *   do **not** use the incoming request URL: the admin reaches GZAC through the Angular dev
     *   proxy on port 4200 (or a reverse proxy in production), neither of which is the URL the
     *   plugin host should call back on. The host typically lives on the same Docker network as the
     *   backend and reaches it on its native port. Operators override per-host in the UI for
     *   non-local topologies.
     * - Broker AMQP URL: built from `spring.rabbitmq.*` (GZAC's own broker view).
     * - Broker exchange: GZAC's outbox publisher exchange.
     */
    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get add-host form defaults",
        nl = "Standaardwaarden voor host ophalen",
    )
    @GetMapping("/host-defaults")
    fun hostDefaults(): ResponseEntity<HostDefaultsResponse> {
        val serverPort = environment.getProperty("server.port", Int::class.java, 8080)
        val gzacCallbackBaseUrl = "http://localhost:$serverPort"

        val rabbitHost = environment.getProperty("spring.rabbitmq.host", "localhost")
        val rabbitPort = environment.getProperty("spring.rabbitmq.port", Int::class.java, 5672)
        val rabbitUsername = environment.getProperty("spring.rabbitmq.username", "guest")
        val rabbitPassword = environment.getProperty("spring.rabbitmq.password", "guest")
        val rabbitVirtualHost = environment.getProperty("spring.rabbitmq.virtual-host", "/")
        val vhostPath = if (rabbitVirtualHost == "/") "" else "/$rabbitVirtualHost"
        val eventBrokerAmqpUrl =
            "amqp://$rabbitUsername:$rabbitPassword@$rabbitHost:$rabbitPort$vhostPath"

        val eventBrokerExchange = environment.getProperty(
            "valtimo.outbox.publisher.rabbitmq.exchange",
            "valtimo-events",
        )

        return ResponseEntity.ok(
            HostDefaultsResponse(
                gzacCallbackBaseUrl = gzacCallbackBaseUrl,
                eventBrokerAmqpUrl = eventBrokerAmqpUrl,
                eventBrokerExchange = eventBrokerExchange,
                defaultEventQueueTtlMs = ExternalPluginHostService.DEFAULT_EVENT_QUEUE_TTL_MS,
                minEventQueueTtlMs = ExternalPluginHostService.MIN_EVENT_QUEUE_TTL_MS,
                maxEventQueueTtlMs = ExternalPluginHostService.MAX_EVENT_QUEUE_TTL_MS,
            )
        )
    }

    /**
     * Lets the UI render the host list with an accurate "delete blocked because…" state without
     * having to attempt the delete and parse a 409. The server-side guard in
     * [ExternalPluginHostService.delete] remains authoritative — this endpoint is advisory only.
     */
    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List usages of an external plugin host",
        nl = "Gebruik van externe-pluginhost ophalen",
    )
    @GetMapping("/host/{hostId}/usages")
    fun listHostUsages(@PathVariable hostId: UUID): ResponseEntity<List<PluginUsageDto>> =
        ResponseEntity.ok(hostService.findUsages(hostId))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete an external plugin host",
        nl = "Externe-pluginhost verwijderen",
    )
    @DeleteMapping("/host/{hostId}")
    fun deleteHost(@PathVariable hostId: UUID): ResponseEntity<Void> {
        hostService.delete(hostId)
        return ResponseEntity.noContent().build()
    }

    /**
     * Uploads a plugin package to the host. Before forwarding the package, GZAC peeks at the
     * manifest's `compatibility` range and refuses an incompatible plugin with `409 Conflict` plus
     * the version details, unless `force=true`. The operator confirms the warning in the UI, which
     * re-issues the request with `force=true` to proceed regardless. A compatible (or
     * undeterminable) plugin uploads straight through.
     */
    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Upload a plugin package to a host",
        nl = "Pluginpakket naar host uploaden",
    )
    @PostMapping("/host/{hostId}/upload", consumes = ["multipart/form-data"])
    fun uploadPlugin(
        @PathVariable hostId: UUID,
        @RequestParam("file") file: MultipartFile,
        @RequestParam(name = "force", required = false, defaultValue = "false") force: Boolean,
    ): ResponseEntity<JsonNode> {
        if (!force) {
            val range = pluginPackageInspector.readCompatibilityRange(file.bytes)
            if (range != null) {
                val compatibility = compatibilityChecker.check(range.minGzacVersion, range.maxGzacVersion)
                if (!compatibility.compatible) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(incompatibilityBody(compatibility))
                }
            }
        }
        val result = hostService.uploadPlugin(hostId, file.originalFilename ?: "plugin.zip", file.bytes)
        discoveryService.discoverAll()
        return ResponseEntity.status(HttpStatus.CREATED).body(result)
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List external plugin definitions",
        nl = "Externe-plugindefinities ophalen",
    )
    @GetMapping("/definition")
    fun listDefinitions(): ResponseEntity<List<DefinitionResponse>> =
        ResponseEntity.ok(definitionService.list().map(::toDefinitionResponse))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get an external plugin definition",
        nl = "Externe-plugindefinitie ophalen",
    )
    @GetMapping("/definition/{definitionId}")
    fun getDefinition(@PathVariable definitionId: UUID): ResponseEntity<DefinitionResponse> =
        ResponseEntity.ok(toDefinitionResponse(definitionService.get(definitionId)))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List external plugin configurations",
        nl = "Externe-pluginconfiguraties ophalen",
    )
    @GetMapping("/configuration")
    fun listConfigurations(
        @RequestParam(required = false) definitionId: UUID?,
    ): ResponseEntity<List<ConfigurationResponse>> =
        ResponseEntity.ok(configurationService.list(definitionId).map(ConfigurationResponse::from))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Get an external plugin configuration",
        nl = "Externe-pluginconfiguratie ophalen",
    )
    @GetMapping("/configuration/{configurationId}")
    fun getConfiguration(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<ConfigurationDetailResponse> {
        val configuration = configurationService.get(configurationId)
        val decrypted = configurationService.decryptedProperties(configuration)
        val grantedEndpoints = configurationService.getGrantedEndpoints(configurationId)
        val grantedEvents = configurationService.getGrantedEvents(configurationId)
        return ResponseEntity.ok(
            ConfigurationDetailResponse(
                id = configuration.id,
                definitionId = configuration.definitionId,
                title = configuration.title,
                properties = decrypted,
                grantedEndpoints = grantedEndpoints.map(GrantedEndpointResponse::from),
                grantedEvents = grantedEvents.map(GrantedEventResponse::from),
                createdAt = configuration.createdAt,
            )
        )
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Create an external plugin configuration",
        nl = "Externe-pluginconfiguratie aanmaken",
    )
    @PostMapping("/configuration")
    fun createConfiguration(
        @RequestBody request: ConfigurationCreateRequest,
    ): ResponseEntity<ConfigurationResponse> {
        val configuration = configurationService.create(
            request.definitionId,
            request.title,
            request.properties,
            request.grantedEndpoints,
            request.grantedEvents,
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(ConfigurationResponse.from(configuration))
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Update an external plugin configuration",
        nl = "Externe-pluginconfiguratie bijwerken",
    )
    @PutMapping("/configuration/{configurationId}")
    fun updateConfiguration(
        @PathVariable configurationId: UUID,
        @RequestBody request: ConfigurationUpdateRequest,
    ): ResponseEntity<ConfigurationResponse> {
        val configuration = configurationService.update(
            configurationId,
            request.title,
            request.properties,
            request.grantedEndpoints,
        )
        return ResponseEntity.ok(ConfigurationResponse.from(configuration))
    }

    /**
     * Mirrors `listHostUsages` but scoped to a single configuration. Lets the management UI
     * pre-emptively disable the delete control on a configuration whose process links would
     * otherwise cause a 409.
     */
    @RunWithoutAuthorization
    @EndpointDescription(
        en = "List usages of an external plugin configuration",
        nl = "Gebruik van externe-pluginconfiguratie ophalen",
    )
    @GetMapping("/configuration/{configurationId}/usages")
    fun listConfigurationUsages(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<List<PluginUsageDto>> =
        ResponseEntity.ok(configurationService.findUsages(configurationId))

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Delete an external plugin configuration",
        nl = "Externe-pluginconfiguratie verwijderen",
    )
    @DeleteMapping("/configuration/{configurationId}")
    fun deleteConfiguration(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<Void> {
        configurationService.delete(configurationId)
        return ResponseEntity.noContent().build()
    }

    @RunWithoutAuthorization
    @EndpointDescription(
        en = "Resolve endpoint descriptions",
        nl = "Endpoint-beschrijvingen ophalen",
    )
    @PostMapping("/endpoint-descriptions")
    fun resolveEndpointDescriptions(
        @RequestBody endpoints: List<EndpointQuery>,
        @RequestParam(defaultValue = "en") locale: String,
    ): ResponseEntity<List<com.ritense.externalplugin.service.EndpointDescription>> =
        ResponseEntity.ok(endpointDescriptionService.resolveDescriptions(endpoints, locale))

    private fun toDefinitionResponse(definition: ExternalPluginDefinition): DefinitionResponse {
        val compatibility = compatibilityChecker.check(definition.minGzacVersion, definition.maxGzacVersion)
        return DefinitionResponse.from(definition, compatibility)
    }

    private fun incompatibilityBody(compatibility: CompatibilityResult): JsonNode =
        objectMapper.createObjectNode().apply {
            put("incompatible", true)
            put("compatible", false)
            put("currentGzacVersion", compatibility.currentGzacVersion)
            put("minGzacVersion", compatibility.minGzacVersion)
            put("maxGzacVersion", compatibility.maxGzacVersion)
        }
}
