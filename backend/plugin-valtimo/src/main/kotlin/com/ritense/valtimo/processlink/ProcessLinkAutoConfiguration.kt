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

package com.ritense.valtimo.processlink

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginProcessLinkRepository
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.plugin.PluginConfigurationExistenceChecker
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.processlink.listener.ProcessLinkChangedEventListener
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import com.ritense.valtimo.processlink.security.config.PluginProcessLinkHttpSecurityConfigurer
import com.ritense.valtimo.processlink.service.PluginConfigurationMappingResolverImpl
import com.ritense.valtimo.processlink.service.PluginProcessLinkService
import com.ritense.valtimo.processlink.service.PluginProcessLinkServiceImpl
import com.ritense.valtimo.processlink.service.PluginSupportedProcessLinksHandler
import com.ritense.valtimo.processlink.web.rest.PluginProcessLinkResource
import com.ritense.valtimo.service.OperatonProcessService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order

@AutoConfiguration
class ProcessLinkAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(ProcessLinkServiceTaskStartListener::class)
    fun pluginLinkServiceTaskStartListener(
        pluginProcessLinkRepository: PluginProcessLinkRepository?,
        pluginService: PluginService?
    ): ProcessLinkServiceTaskStartListener {
        return ProcessLinkServiceTaskStartListener(
            pluginProcessLinkRepository!!,
            pluginService!!
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkUserTaskCreateListener::class)
    fun processLinkUserTaskCreateListener(
        pluginProcessLinkRepository: PluginProcessLinkRepository?,
        pluginService: PluginService?
    ): ProcessLinkUserTaskCreateListener {
        return ProcessLinkUserTaskCreateListener(
            pluginProcessLinkRepository!!,
            pluginService!!
        )
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkCallActivityStartListener::class)
    fun processLinkCallActivityStartListener(
        pluginProcessLinkRepository: PluginProcessLinkRepository?,
        pluginService: PluginService?
    ): ProcessLinkCallActivityStartListener {
        return ProcessLinkCallActivityStartListener(
            pluginProcessLinkRepository!!,
            pluginService!!
        )
    }

    @Bean
    @ConditionalOnMissingBean(PluginProcessLinkMapper::class)
    fun pluginProcessLinkMapper(
        objectMapper: ObjectMapper,
        pluginConfigurationRepository: PluginConfigurationRepository,
        pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
    ): PluginProcessLinkMapper {
        return PluginProcessLinkMapper(objectMapper, pluginConfigurationRepository, pluginProcessLinkRepository)
    }

    @Bean
    @Order(30)
    @ConditionalOnMissingBean(PluginSupportedProcessLinksHandler::class)
    fun pluginSupportedProcessLinksHandler(pluginService: PluginService): PluginSupportedProcessLinksHandler {
        return PluginSupportedProcessLinksHandler(pluginService)
    }

    @Bean
    @ConditionalOnMissingBean(PluginProcessLinkService::class)
    fun pluginProcessLinkService(
        processLinkService: ProcessLinkService,
        pluginProcessLinkMapper: PluginProcessLinkMapper,
        pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
        operatonProcessService: OperatonProcessService
    ): PluginProcessLinkService {
        return PluginProcessLinkServiceImpl(
            processLinkService,
            pluginProcessLinkMapper,
            pluginProcessLinkRepository,
            operatonProcessService
        )
    }

    @Order(270)
    @Bean
    @ConditionalOnMissingBean(PluginProcessLinkHttpSecurityConfigurer::class)
    fun pluginProcessLinkHttpSecurityConfigurer(): PluginProcessLinkHttpSecurityConfigurer {
        return PluginProcessLinkHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(PluginProcessLinkResource::class)
    fun pluginProcessLinkResource(
        pluginProcessLinkService: PluginProcessLinkService
    ): PluginProcessLinkResource {
        return PluginProcessLinkResource(pluginProcessLinkService)
    }

    @Bean
    @ConditionalOnMissingBean(PluginConfigurationExistenceChecker::class)
    fun pluginConfigurationExistenceChecker(
        pluginConfigurationRepository: PluginConfigurationRepository
    ): PluginConfigurationExistenceChecker {
        return PluginConfigurationExistenceChecker { uuid ->
            pluginConfigurationRepository.existsById(PluginConfigurationId.existingId(uuid))
        }
    }

    @Bean
    @ConditionalOnMissingBean(ProcessLinkChangedEventListener::class)
    fun processLinkChangedEventListener(
        pluginConfigurationMappingResolver: PluginConfigurationMappingResolver,
    ): ProcessLinkChangedEventListener {
        return ProcessLinkChangedEventListener(pluginConfigurationMappingResolver as PluginConfigurationMappingResolverImpl)
    }

    @Bean
    @ConditionalOnMissingBean(PluginConfigurationMappingResolver::class)
    fun pluginConfigurationMappingResolver(
        pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
        pluginConfigurationRepository: PluginConfigurationRepository,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        caseDefinitionChecker: CaseDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ): PluginConfigurationMappingResolver {
        return PluginConfigurationMappingResolverImpl(
            pluginProcessLinkRepository,
            pluginConfigurationRepository,
            processDefinitionCaseDefinitionService,
            caseDefinitionChecker,
            applicationEventPublisher,
        )
    }
}
