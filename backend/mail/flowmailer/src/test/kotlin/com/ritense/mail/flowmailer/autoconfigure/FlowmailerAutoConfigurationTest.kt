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

package com.ritense.mail.flowmailer.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.http.converter.autoconfigure.HttpMessageConvertersAutoConfiguration
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.jackson2.autoconfigure.Jackson2AutoConfiguration
import org.springframework.boot.restclient.autoconfigure.RestTemplateAutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.web.client.RestTemplate
import kotlin.test.assertIs
import kotlin.test.assertSame

@Suppress("DEPRECATION")
class FlowmailerAutoConfigurationTest {

    private val contextRunner = ApplicationContextRunner()
        .withConfiguration(
            AutoConfigurations.of(
                JacksonAutoConfiguration::class.java,
                Jackson2AutoConfiguration::class.java,
                HttpMessageConvertersAutoConfiguration::class.java,
                RestTemplateAutoConfiguration::class.java,
                FlowmailerAutoConfiguration::class.java,
            )
        )
        .withPropertyValues(
            "spring.http.converters.preferred-json-mapper=jackson2",
            "valtimo.flowmailer.client-id=id",
            "valtimo.flowmailer.client-secret=secret",
            "valtimo.flowmailer.account-id=account",
        )

    @Test
    fun `should write JSON with the Jackson 2 object mapper`() {
        contextRunner.run { context ->
            val jsonConverter = context.getBean(RestTemplate::class.java).messageConverters
                .first { it.canWrite(Map::class.java, MediaType.APPLICATION_JSON) }

            assertIs<MappingJackson2HttpMessageConverter>(jsonConverter)
            assertSame(context.getBean(ObjectMapper::class.java), jsonConverter.objectMapper)
        }
    }
}
