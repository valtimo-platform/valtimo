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

import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.core.env.MapPropertySource
import org.springframework.mock.env.MockEnvironment
import kotlin.test.assertEquals

class Jackson2PreferredEnvironmentPostProcessorTest {

    private val processor = Jackson2PreferredEnvironmentPostProcessor()

    @Test
    fun `should default preferred json mapper to jackson2`() {
        val environment = MockEnvironment()

        processor.postProcessEnvironment(environment, SpringApplication())

        assertEquals("jackson2", environment.getProperty(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_MAPPER))
    }

    @Test
    fun `should default preferred json codec mapper to jackson2`() {
        val environment = MockEnvironment()

        processor.postProcessEnvironment(environment, SpringApplication())

        assertEquals("jackson2", environment.getProperty(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_CODEC_MAPPER))
    }

    @Test
    fun `should not override explicitly configured preferred json mapper`() {
        val environment = MockEnvironment()
        environment.propertySources.addFirst(
            MapPropertySource("explicit", mapOf(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_MAPPER to "jackson"))
        )

        processor.postProcessEnvironment(environment, SpringApplication())

        assertEquals("jackson", environment.getProperty(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_MAPPER))
    }

    @Test
    fun `should not override explicitly configured preferred json codec mapper`() {
        val environment = MockEnvironment()
        environment.propertySources.addFirst(
            MapPropertySource("explicit", mapOf(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_CODEC_MAPPER to "jackson"))
        )

        processor.postProcessEnvironment(environment, SpringApplication())

        assertEquals("jackson", environment.getProperty(Jackson2PreferredEnvironmentPostProcessor.PREFERRED_JSON_CODEC_MAPPER))
    }
}
