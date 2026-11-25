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


package com.ritense.valtimo.contract.json

import org.springframework.boot.EnvironmentPostProcessor
import org.springframework.boot.SpringApplication
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.MapPropertySource

/**
 * Valtimo serializes with Jackson 2. Spring Boot 4 prefers Jackson 3 for HTTP message converters and
 * WebClient codecs unless told otherwise, so this registers `jackson2` as the lowest-precedence default for both.
 */
class Jackson2PreferredEnvironmentPostProcessor : EnvironmentPostProcessor {

    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        if (!environment.propertySources.contains(PROPERTY_SOURCE_NAME)) {
            environment.propertySources.addLast(
                MapPropertySource(
                    PROPERTY_SOURCE_NAME,
                    mapOf(
                        PREFERRED_JSON_MAPPER to "jackson2",
                        PREFERRED_JSON_CODEC_MAPPER to "jackson2",
                    )
                )
            )
        }
    }

    companion object {
        const val PROPERTY_SOURCE_NAME = "valtimoJackson2Defaults"
        const val PREFERRED_JSON_MAPPER = "spring.http.converters.preferred-json-mapper"
        const val PREFERRED_JSON_CODEC_MAPPER = "spring.http.codecs.preferred-json-mapper"
    }
}
