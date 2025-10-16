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

package com.ritense.inbox.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.inbox.InboxEventHandler
import com.ritense.inbox.InboxHandlingService
import com.ritense.inbox.LocalCloudEventListener
import com.ritense.inbox.ValtimoCloudEventMapper
import com.ritense.inbox.ValtimoEventHandler
import com.ritense.inbox.ValtimoInboxEventHandler
import com.ritense.inbox.consumer.InboxCloudEventConsumer
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureAfter
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean

@AutoConfiguration
@AutoConfigureAfter(name = ["com.ritense.outbox.config.DisabledOutboxAutoConfiguration", "com.ritense.outbox.config.OutboxAutoConfiguration"])
class InboxAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(InboxHandlingService::class)
    fun inboxHandlingService(
        eventHandlers: List<InboxEventHandler>
    ): InboxHandlingService {
        return InboxHandlingService(eventHandlers)
    }

    @Bean
    @ConditionalOnMissingBean(ValtimoCloudEventMapper::class)
    fun valtimoCloudEventMapper(
        objectMapper: ObjectMapper
    ): ValtimoCloudEventMapper {
        return ValtimoCloudEventMapper(objectMapper)
    }

    @Bean
    fun valtimoInboxEventHandler(
        eventHandlers: List<ValtimoEventHandler>,
        cloudEventMapper: ValtimoCloudEventMapper
    ): InboxEventHandler {
        return ValtimoInboxEventHandler(eventHandlers, cloudEventMapper)
    }

    @Bean
    @ConditionalOnClass(name = ["com.ritense.outbox.LocalOutboxService"])
    @ConditionalOnProperty(name = ["valtimo.outbox.enabled"], havingValue = "false", matchIfMissing = true)
    fun localCloudEventListener(
        eventHandlers: List<ValtimoEventHandler>,
        cloudEventMapper: ValtimoCloudEventMapper
    ): LocalCloudEventListener {
        return LocalCloudEventListener(eventHandlers, cloudEventMapper)
    }

    @Bean
    fun inboxCloudEventConsumer(inboxHandlingService: InboxHandlingService): InboxCloudEventConsumer {
        return InboxCloudEventConsumer(inboxHandlingService)
    }

    /**
     * This bean exists because Spring Stream does not seem to be able to configure Kotlin classes of (Java) type Consumer.
     */
    @Bean
    fun kotlinInboxCloudEventConsumer(inboxCloudEventConsumer: InboxCloudEventConsumer): (String) -> Unit {
        return { message -> inboxCloudEventConsumer.accept(message) }
    }
}
