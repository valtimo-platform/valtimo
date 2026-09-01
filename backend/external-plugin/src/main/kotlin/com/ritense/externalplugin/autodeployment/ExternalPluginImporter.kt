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

package com.ritense.externalplugin.autodeployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.EXTERNAL_PLUGIN
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.env.Environment
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class ExternalPluginImporter(
    private val environment: Environment,
    private val objectMapper: ObjectMapper,
    private val hostService: ExternalPluginHostService,
    private val configurationService: ExternalPluginConfigurationService,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val packageDeployer: ExternalPluginPackageDeployer,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val pluginConfigurationMappingResolvers: List<PluginConfigurationMappingResolver>,
) : Importer {
    override fun type() = EXTERNAL_PLUGIN

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition() = false

    override fun import(request: ImportRequest) {
        val content = resolveProperties(request.content.toString(Charsets.UTF_8))
        val descriptor = objectMapper.readValue(content, ExternalPluginDeploymentDto::class.java)

        val summary = DeploymentSummary()
        descriptor.integrations.forEach { deployIntegration(it, summary) }
        logger.info { "Deployed external plugin integrations from '${request.fileName}': $summary" }
    }

    override fun afterImport(request: ImportRequest) {
        if (pluginConfigurationMappingResolvers.isEmpty()) return
        caseDefinitionRepository.findAll().forEach { caseDefinition ->
            pluginConfigurationMappingResolvers.forEach { resolver ->
                resolver.recheckIssuesForCaseDefinition(caseDefinition.id)
            }
        }
    }

    private fun deployIntegration(integration: IntegrationDeploymentDto, summary: DeploymentSummary) {
        val host = resolveHost(integration, summary) ?: return
        registerPackages(integration, host, summary)
        integration.configurations.forEach { deployConfiguration(integration, host, it, summary) }
    }

    private fun resolveHost(
        integration: IntegrationDeploymentDto,
        summary: DeploymentSummary,
    ): ExternalPluginHost? {
        val existing = hostService.findById(integration.id)
        if (existing != null) {
            reconcileHost(integration, existing)
            summary.integrationsReconciled++
            return existing
        }

        val sameAddress = hostService.findByBaseUrl(integration.baseUrl)
        if (sameAddress != null) {
            logger.warn {
                "Skipping external plugin integration '${integration.name}' (${integration.id}): " +
                    "host ${sameAddress.id} ('${sameAddress.name}') is already registered at " +
                    "${sameAddress.baseUrl}. Align the descriptor's id with the existing host, or " +
                    "delete that host first."
            }
            summary.integrationsSkipped++
            return null
        }

        val registered = hostService.register(
            name = integration.name,
            baseUrl = integration.baseUrl,
            secret = integration.secret,
            gzacCallbackBaseUrl = integration.gzacCallbackBaseUrl,
            eventBrokerAmqpUrl = integration.eventBrokerAmqpUrl,
            eventBrokerExchange = integration.eventBrokerExchange,
            eventQueueMode = integration.eventQueueMode,
            eventQueueTtlMs = integration.eventQueueTtlMs,
            kind = integration.kind,
            frontendOrigins = integration.frontendOrigins,
            id = integration.id,
        )
        logger.info {
            "Registered external plugin integration '${integration.name}' (${integration.id}) at " +
                "${registered.baseUrl} as ${registered.kind}"
        }
        summary.integrationsRegistered++
        return registered
    }

    private fun reconcileHost(integration: IntegrationDeploymentDto, host: ExternalPluginHost) {
        immutableDrift(integration, host).forEach { field ->
            logger.warn {
                "External plugin integration '${integration.name}' (${integration.id}) declares a " +
                    "different $field than the registered host. Descriptors never change connection " +
                    "fields on an existing host; it was left unchanged. Edit the integration's " +
                    "connection in the admin UI to change it."
            }
        }

        val declaredOrigins = ExternalPluginHostService.normalizeFrontendOrigins(integration.frontendOrigins)
        if (declaredOrigins != host.frontendOriginList) {
            hostService.updateFrontendOrigins(host.id, integration.frontendOrigins)
        }

        if (integration.eventQueueMode != host.eventQueueMode || integration.eventQueueTtlMs != host.eventQueueTtlMs) {
            hostService.updateEventQueue(host.id, integration.eventQueueMode, integration.eventQueueTtlMs)
        }
    }

    private fun immutableDrift(integration: IntegrationDeploymentDto, host: ExternalPluginHost): List<String> {
        val drift = mutableListOf<String>()
        if (integration.baseUrl.trimEnd('/') != host.baseUrl) drift += "baseUrl"
        if (integration.gzacCallbackBaseUrl.trimEnd('/') != host.gzacCallbackBaseUrl) drift += "gzacCallbackBaseUrl"
        if (integration.kind != host.kind) drift += "kind"
        if (integration.eventBrokerAmqpUrl?.takeIf { it.isNotBlank() } != host.eventBrokerAmqpUrl) {
            drift += "eventBrokerAmqpUrl"
        }
        if (integration.eventBrokerExchange?.takeIf { it.isNotBlank() } != host.eventBrokerExchange) {
            drift += "eventBrokerExchange"
        }
        val storedSecret = runCatching { hostService.decryptedSecret(host) }.getOrNull()
        if (storedSecret != null && storedSecret != integration.secret) drift += "secret"
        return drift
    }

    private fun registerPackages(
        integration: IntegrationDeploymentDto,
        host: ExternalPluginHost,
        summary: DeploymentSummary,
    ) {
        if (integration.packages.isEmpty()) return
        require(integration.kind != ExternalPluginHostKind.APP) {
            "External plugin integration '${integration.name}' (${integration.id}) is an app but " +
                "declares ${integration.packages.size} package(s). Apps serve their own plugin and " +
                "accept no uploads — remove the 'packages' entry from the descriptor."
        }
        packageDeployer.register(host.id, integration.packages)
        summary.packagesPending += integration.packages.size
    }

    private fun deployConfiguration(
        integration: IntegrationDeploymentDto,
        host: ExternalPluginHost,
        configuration: ConfigurationDeploymentDto,
        summary: DeploymentSummary,
    ) {
        val existing = configurationRepository.findById(configuration.id).orElse(null)
        if (existing != null) {
            updateConfiguration(existing, configuration, summary)
            return
        }

        val definition = resolveDefinition(integration, host, configuration, summary) ?: return

        configurationService.create(
            definitionId = definition.id,
            title = configuration.title,
            properties = configuration.properties,
            grantedEndpoints = configuration.grantedEndpoints,
            grantedEvents = configuration.grantedEvents.map(::GrantedEventEntry),
            grantedCapabilities = configuration.grantedCapabilities,
            grantedEgress = configuration.grantedEgress,
            id = configuration.id,
            allowPlaceholder = true,
        )
        logger.info {
            "Activated external plugin configuration '${configuration.title}' (${configuration.id}) " +
                "for '${configuration.pluginId}@${configuration.pluginVersion}' on '${integration.name}'"
        }
        summary.configurationsCreated++
    }

    /**
     * Title and properties only. Grants are left alone: the exact-match rule leaves exactly one
     * valid set per manifest, so re-granting could only rewrite them to what is already stored.
     */
    private fun updateConfiguration(
        existing: ExternalPluginConfiguration,
        declared: ConfigurationDeploymentDto,
        summary: DeploymentSummary,
    ) {
        val egressBefore = configurationService.getDerivedEgress(existing)

        configurationService.update(
            id = declared.id,
            title = declared.title,
            properties = declared.properties,
        )
        summary.configurationsUpdated++

        // The one configuration change with a security dimension: an `x-egress-target` property
        // decides what the plugin may reach. Applied without approval because the descriptor is
        // trusted, but never silently.
        val egressAfter = configurationService.getDerivedEgress(configurationService.get(declared.id))
        if (egressBefore.toSet() != egressAfter.toSet()) {
            logger.info {
                "Configuration ${declared.id} ('${declared.title}') changed the destinations its " +
                    "plugin may call: $egressBefore -> $egressAfter"
            }
        }
    }

    private fun resolveDefinition(
        integration: IntegrationDeploymentDto,
        host: ExternalPluginHost,
        configuration: ConfigurationDeploymentDto,
        summary: DeploymentSummary,
    ): ExternalPluginDefinition? {
        val existing = definitionRepository.findByPluginIdAndVersion(
            configuration.pluginId,
            configuration.pluginVersion,
        )
        if (existing != null) {
            if (existing.hostId != host.id) {
                logger.warn {
                    "Cannot activate external plugin configuration '${configuration.title}': plugin " +
                        "'${configuration.pluginId}@${configuration.pluginVersion}' is registered on host " +
                        "${existing.hostId}, not on integration '${integration.name}' (${host.id})"
                }
                summary.configurationsSkipped++
                return null
            }
            return existing
        }

        val placeholder = definitionRepository.save(
            ExternalPluginDefinition(
                id = UUID.randomUUID(),
                pluginId = configuration.pluginId,
                version = configuration.pluginVersion,
                hostId = host.id,
                baseUrl = "${host.baseUrl}/plugins/${configuration.pluginId}",
                status = ExternalPluginDefinitionStatus.UNAVAILABLE,
            )
        )
        summary.placeholdersCreated++
        return placeholder
    }

    private fun resolveProperties(content: String): String {
        var resolved = content
        PLACEHOLDER.findAll(content)
            .map { it.groupValues }
            .forEach { (placeholder, expression) ->
                val name = expression.substringBefore(':')
                val default = expression
                    .substringAfter(':', missingDelimiterValue = "")
                    .takeIf { ':' in expression }
                val value = environment.getProperty(name)?.takeIf { it.isNotBlank() } ?: default
                if (value != null) {
                    resolved = resolved.replace(placeholder, value)
                }
            }
        return resolved
    }

    private class DeploymentSummary {
        var integrationsRegistered = 0
        var integrationsReconciled = 0
        var integrationsSkipped = 0
        var packagesPending = 0
        var placeholdersCreated = 0
        var configurationsCreated = 0
        var configurationsUpdated = 0
        var configurationsSkipped = 0

        override fun toString(): String =
            "integrations(registered=$integrationsRegistered, reconciled=$integrationsReconciled, " +
                "skipped=$integrationsSkipped), packages(pendingUpload=$packagesPending), " +
                "placeholderDefinitions=$placeholdersCreated, " +
                "configurations(created=$configurationsCreated, updated=$configurationsUpdated, " +
                "skipped=$configurationsSkipped)"
    }

    private companion object {
        private val logger = KotlinLogging.logger {}

        private val FILENAME_REGEX = """/global/external-plugin/(?:.*/)?(.+)\.externalplugin\.json""".toRegex()

        private val PLACEHOLDER = Regex("\\$\\{([^}]+)}")
    }
}
