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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.diagnostics.FailureAnalyzer
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.jackson2.autoconfigure.Jackson2AutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import java.util.Properties

class JacksonPropertiesFailureAnalyzerTest {

    private lateinit var originalMapper: ObjectMapper

    private val contextRunner = ApplicationContextRunner()
        .withConfiguration(
            AutoConfigurations.of(
                JacksonAutoConfiguration::class.java,
                Jackson2AutoConfiguration::class.java,
                SpringJacksonPropertiesAutoConfiguration::class.java,
            )
        )
        .withUserConfiguration(MapperSingletonAutoConfiguration::class.java)

    @BeforeEach
    fun saveMapperSingleton() {
        originalMapper = MapperSingleton.get()
    }

    @AfterEach
    fun restoreMapperSingleton() {
        MapperSingleton.set(originalMapper)
    }

    @Test
    fun `should tell to move a Jackson 2 feature key to spring jackson2`() {
        contextRunner
            .withPropertyValues("spring.jackson.serialization.write-dates-as-timestamps=false")
            .run { context ->
                val analysis = checkNotNull(JacksonPropertiesFailureAnalyzer().analyze(checkNotNull(context.startupFailure)))

                assertThat(analysis.description).contains("spring.jackson.serialization.write-dates-as-timestamps")
                assertThat(analysis.action).contains("spring.jackson2.serialization.write-dates-as-timestamps")
            }
    }

    @Test
    fun `should start and apply the key under spring jackson2`() {
        contextRunner
            .withPropertyValues("spring.jackson2.serialization.write-dates-as-timestamps=true")
            .run { context ->
                assertThat(context.startupFailure).isNull()
                assertThat(context.getBean(ObjectMapper::class.java).isEnabled(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS))
                    .isTrue()
            }
    }

    @Test
    fun `should be registered as a failure analyzer`() {
        val registered = javaClass.classLoader.getResources("META-INF/spring.factories").toList()
            .map { url -> url.openStream().use { Properties().apply { load(it) } } }
            .mapNotNull { it.getProperty(FailureAnalyzer::class.java.name) }

        assertThat(registered).anyMatch { it.contains(JacksonPropertiesFailureAnalyzer::class.java.name) }
    }
}
