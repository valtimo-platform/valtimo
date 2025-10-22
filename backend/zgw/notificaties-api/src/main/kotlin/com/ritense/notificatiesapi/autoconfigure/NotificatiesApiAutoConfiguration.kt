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

package com.ritense.notificatiesapi.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.notificatiesapi.NotificatiesApiPluginFactory
import com.ritense.notificatiesapi.client.NotificatiesApiClient
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.health.NotificatiesApiInboundEventHealthIndicator
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.notificatiesapi.security.config.NotificatiesApiHttpSecurityConfigurer
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventAdminService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventIntakeService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventProcessingService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventQueryService
import com.ritense.notificatiesapi.service.NotificatiesApiInboundEventWorker
import com.ritense.notificatiesapi.service.NotificatiesApiService
import com.ritense.notificatiesapi.web.rest.NotificatiesApiManagementResource
import com.ritense.notificatiesapi.web.rest.NotificatiesApiResource
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.service.PluginService
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.core.task.TaskExecutor
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import org.springframework.web.client.RestClient

@AutoConfiguration
@EnableConfigurationProperties(NotificatiesApiProcessingProperties::class)
@EnableJpaRepositories(basePackages = ["com.ritense.notificatiesapi.repository"])
@EntityScan("com.ritense.notificatiesapi.domain")
@EnableScheduling
class NotificatiesApiAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(NotificatiesApiClient::class)
    fun notificatiesApiClient(restClientBuilder: RestClient.Builder): NotificatiesApiClient {
        return NotificatiesApiClient(restClientBuilder)
    }

    @Bean
    @ConditionalOnMissingBean(NotificatiesApiPluginFactory::class)
    fun notificatiesApiPluginFactory(
        pluginService: PluginService,
        pluginConfigurationRepository: PluginConfigurationRepository,
        client: NotificatiesApiClient,
        abonnementLinkRepository: NotificatiesApiAbonnementLinkRepository
    ): NotificatiesApiPluginFactory {
        return NotificatiesApiPluginFactory(
            pluginService,
            client,
            abonnementLinkRepository
        )
    }

    @Bean
    fun notificatiesApiInboundEventIntakeService(
        objectMapper: ObjectMapper,
        inboundEventRepository: NotificatiesApiInboundEventRepository,
        processingProperties: NotificatiesApiProcessingProperties
    ): NotificatiesApiInboundEventIntakeService {
        return NotificatiesApiInboundEventIntakeService(
            objectMapper,
            inboundEventRepository,
            processingProperties
        )
    }

    @Bean
    fun notificatiesApiService(
        notificatiesApiAbonnementLinkRepository: NotificatiesApiAbonnementLinkRepository,
        inboundEventIntakeService: NotificatiesApiInboundEventIntakeService,
        inboundEventProcessingService: NotificatiesApiInboundEventProcessingService,
        @Qualifier("notificatiesApiTaskExecutor") taskExecutor: TaskExecutor
    ): NotificatiesApiService {
        return NotificatiesApiService(
            notificatiesApiAbonnementLinkRepository,
            inboundEventIntakeService,
            inboundEventProcessingService,
            taskExecutor
        )
    }

    @Bean
    fun notificatiesApiInboundEventProcessingService(
        inboundEventRepository: NotificatiesApiInboundEventRepository,
        applicationEventPublisher: ApplicationEventPublisher,
        objectMapper: ObjectMapper,
        processingProperties: NotificatiesApiProcessingProperties
    ): NotificatiesApiInboundEventProcessingService {
        return NotificatiesApiInboundEventProcessingService(
            inboundEventRepository,
            applicationEventPublisher,
            objectMapper,
            processingProperties
        )
    }

    @Bean
    fun notificatiesApiInboundEventWorker(
        processingProperties: NotificatiesApiProcessingProperties,
        processingService: NotificatiesApiInboundEventProcessingService
    ): NotificatiesApiInboundEventWorker {
        return NotificatiesApiInboundEventWorker(
            processingProperties,
            processingService
        )
    }

    @Bean("notificatiesApiTaskExecutor")
    fun notificatiesApiTaskExecutor(processingProperties: NotificatiesApiProcessingProperties): TaskExecutor {
        return ThreadPoolTaskExecutor().apply {
            threadNamePrefix = "notificaties-api-task-"
            corePoolSize = processingProperties.executorCorePoolSize
            maxPoolSize = processingProperties.executorMaxPoolSize
            setQueueCapacity(processingProperties.executorQueueCapacity)
            setWaitForTasksToCompleteOnShutdown(true)
            initialize()
        }
    }

    @Bean
    fun notificatiesApiInboundEventQueryService(
        inboundEventRepository: NotificatiesApiInboundEventRepository
    ): NotificatiesApiInboundEventQueryService {
        return NotificatiesApiInboundEventQueryService(inboundEventRepository)
    }

    @Bean
    fun notificatiesApiInboundEventAdminService(
        inboundEventRepository: NotificatiesApiInboundEventRepository,
        processingProperties: NotificatiesApiProcessingProperties
    ): NotificatiesApiInboundEventAdminService {
        return NotificatiesApiInboundEventAdminService(
            inboundEventRepository,
            processingProperties
        )
    }

    @Bean
    @ConditionalOnMissingBean(NotificatiesApiResource::class)
    fun notificatiesApiResource(notificatiesApiService: NotificatiesApiService): NotificatiesApiResource {
        return NotificatiesApiResource(notificatiesApiService)
    }

    @Bean
    @ConditionalOnMissingBean(NotificatiesApiManagementResource::class)
    fun notificatiesApiManagementResource(
        inboundEventQueryService: NotificatiesApiInboundEventQueryService,
        inboundEventAdminService: NotificatiesApiInboundEventAdminService
    ): NotificatiesApiManagementResource {
        return NotificatiesApiManagementResource(
            inboundEventQueryService,
            inboundEventAdminService
        )
    }

    @Bean
    fun notificatiesApiInboundEventHealthIndicator(
        inboundEventRepository: NotificatiesApiInboundEventRepository,
        processingProperties: NotificatiesApiProcessingProperties
    ): NotificatiesApiInboundEventHealthIndicator {
        return NotificatiesApiInboundEventHealthIndicator(
            inboundEventRepository,
            processingProperties
        )
    }

    @Bean
    @Order(270)
    fun notificatiesApiHttpSecurityConfigurer(): NotificatiesApiHttpSecurityConfigurer {
        return NotificatiesApiHttpSecurityConfigurer()
    }
}
