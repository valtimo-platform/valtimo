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
package com.ritense.valtimo.test.golden

import org.springframework.beans.factory.config.BeanPostProcessor
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.core.env.Environment
import java.nio.file.Paths

@AutoConfiguration
@ConditionalOnClass(name = ["com.ritense.outbox.repository.OutboxMessageRepository"])
@ConditionalOnProperty("valtimo.golden.events.dir")
class OutboxEventRecorderAutoConfiguration {

    companion object {
        @Bean
        @JvmStatic
        fun outboxEventRecorder(environment: Environment): BeanPostProcessor =
            OutboxEventRecorder(Paths.get(environment.getRequiredProperty("valtimo.golden.events.dir")))
    }
}
