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
import com.fasterxml.jackson.databind.node.ObjectNode
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.http.codec.CodecCustomizer
import org.springframework.boot.http.codec.autoconfigure.CodecsAutoConfiguration
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.jackson2.autoconfigure.Jackson2AutoConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.core.ResolvableType
import org.springframework.http.MediaType
import org.springframework.http.codec.DecoderHttpMessageReader
import org.springframework.http.codec.EncoderHttpMessageWriter
import org.springframework.http.codec.json.Jackson2JsonDecoder
import org.springframework.http.codec.json.Jackson2JsonEncoder
import org.springframework.http.codec.ClientCodecConfigurer
import kotlin.test.assertIs
import kotlin.test.assertSame

@Suppress("DEPRECATION")
class Jackson2PreferredCodecsTest {

    private val contextRunner = ApplicationContextRunner()
        .withInitializer { context ->
            Jackson2PreferredEnvironmentPostProcessor().postProcessEnvironment(context.environment, SpringApplication())
        }
        .withConfiguration(
            AutoConfigurations.of(
                JacksonAutoConfiguration::class.java,
                Jackson2AutoConfiguration::class.java,
                CodecsAutoConfiguration::class.java,
            )
        )

    @Test
    fun `should encode WebClient JSON with the Jackson 2 object mapper`() {
        contextRunner.run { context ->
            val configurer = ClientCodecConfigurer.create()
            context.getBeanProvider(CodecCustomizer::class.java).orderedStream().forEach { it.customize(configurer) }

            val jsonWriter = configurer.writers
                .first { it.canWrite(ResolvableType.forClass(ObjectNode::class.java), MediaType.APPLICATION_JSON) }
            val encoder = assertIs<EncoderHttpMessageWriter<*>>(jsonWriter).encoder

            assertIs<Jackson2JsonEncoder>(encoder)
            assertSame(context.getBean(ObjectMapper::class.java), encoder.objectMapper)
        }
    }

    @Test
    fun `should decode WebClient JSON with the Jackson 2 object mapper`() {
        contextRunner.run { context ->
            val configurer = ClientCodecConfigurer.create()
            context.getBeanProvider(CodecCustomizer::class.java).orderedStream().forEach { it.customize(configurer) }

            val jsonReader = configurer.readers
                .first { it.canRead(ResolvableType.forClass(ObjectNode::class.java), MediaType.APPLICATION_JSON) }
            val decoder = assertIs<DecoderHttpMessageReader<*>>(jsonReader).decoder

            assertIs<Jackson2JsonDecoder>(decoder)
            assertSame(context.getBean(ObjectMapper::class.java), decoder.objectMapper)
        }
    }
}
