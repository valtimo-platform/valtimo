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

@file:Suppress("DEPRECATION")

package com.ritense.valtimo.contract.json

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.config.BeanPostProcessor
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.context.properties.bind.Bindable
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.jackson2.autoconfigure.Jackson2Properties
import org.springframework.context.annotation.Bean
import org.springframework.core.env.Environment

/**
 * Boot 4 binds `spring.jackson.*` to the Jackson 3 mapper only; the Jackson 2 mapper reads `spring.jackson2.*`.
 * Valtimo serializes with Jackson 2, so `spring.jackson.*` is bound onto [Jackson2Properties] as well.
 * `spring.jackson2.*` is bound last and wins.
 */
@AutoConfiguration
@ConditionalOnClass(ObjectMapper::class, Jackson2Properties::class)
class SpringJacksonPropertiesAutoConfiguration {

    companion object {
        @JvmStatic
        @Bean
        fun springJacksonToJackson2PropertiesBinder(environment: Environment): BeanPostProcessor {
            return SpringJacksonToJackson2PropertiesBinder(environment)
        }
    }

    class SpringJacksonToJackson2PropertiesBinder(private val environment: Environment) : BeanPostProcessor {
        override fun postProcessBeforeInitialization(bean: Any, beanName: String): Any {
            if (bean is Jackson2Properties) {
                val binder = Binder.get(environment)
                binder.bind("spring.jackson", Bindable.ofInstance(bean))
                binder.bind("spring.jackson2", Bindable.ofInstance(bean))
            }
            return bean
        }
    }
}
