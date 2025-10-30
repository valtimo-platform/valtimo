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

package com.ritense.outbox.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.outbox.CloudEventFactory
import com.ritense.outbox.LocalOutboxService
import com.ritense.outbox.OutboxService
import com.ritense.outbox.UserProvider
import com.ritense.outbox.config.condition.ConditionalOnOutboxEnabled
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean

@AutoConfiguration
@ConditionalOnOutboxEnabled(false)
class DisabledOutboxAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(UserProvider::class)
    fun userProvider(): UserProvider {
        return UserProvider()
    }

    @Bean
    @ConditionalOnMissingBean(CloudEventFactory::class)
    fun cloudEventFactory(
        objectMapper: ObjectMapper,
        userProvider: UserProvider,
        @Value("\${valtimo.outbox.publisher.cloudevent-source:\${spring.application.name:application}}") cloudEventSource: String,
    ): CloudEventFactory {
        return CloudEventFactory(objectMapper, userProvider, cloudEventSource)
    }

    @Bean
    @ConditionalOnMissingBean(OutboxService::class)
    fun localOutboxService(
        cloudEventFactory: CloudEventFactory,
        applicationEventPublisher: ApplicationEventPublisher
    ): OutboxService {
        return LocalOutboxService(cloudEventFactory, applicationEventPublisher)
    }
}
