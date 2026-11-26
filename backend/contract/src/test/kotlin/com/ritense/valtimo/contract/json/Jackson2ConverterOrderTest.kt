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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.http.converter.autoconfigure.HttpMessageConvertersAutoConfiguration
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.jackson2.autoconfigure.Jackson2AutoConfiguration
import org.springframework.boot.restclient.autoconfigure.RestClientAutoConfiguration
import org.springframework.boot.restclient.autoconfigure.RestTemplateAutoConfiguration
import org.springframework.boot.restclient.RestTemplateBuilder
import org.springframework.boot.test.context.runner.WebApplicationContextRunner
import org.springframework.boot.webmvc.autoconfigure.WebMvcAutoConfiguration
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType.APPLICATION_JSON
import org.springframework.http.converter.HttpMessageConverter
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter
import java.util.Date

@Suppress("DEPRECATION")
class Jackson2ConverterOrderTest {

    private lateinit var originalMapper: ObjectMapper

    private val contextRunner = WebApplicationContextRunner()
        .withInitializer { context ->
            Jackson2PreferredEnvironmentPostProcessor().postProcessEnvironment(context.environment, SpringApplication())
        }
        .withConfiguration(
            AutoConfigurations.of(
                JacksonAutoConfiguration::class.java,
                Jackson2AutoConfiguration::class.java,
                SpringJacksonPropertiesAutoConfiguration::class.java,
                HttpMessageConvertersAutoConfiguration::class.java,
                WebMvcAutoConfiguration::class.java,
                RestTemplateAutoConfiguration::class.java,
                RestClientAutoConfiguration::class.java,
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
    fun `MVC writes JSON with exactly one Jackson 2 converter ahead of Jackson 3`() {
        contextRunner.run { context ->
            val converters = context.getBean(RequestMappingHandlerAdapter::class.java).messageConverters

            assertJackson2First(converters, context.getBean(ObjectMapper::class.java))
        }
    }

    @Test
    fun `RestTemplate writes JSON with exactly one Jackson 2 converter ahead of Jackson 3`() {
        contextRunner.run { context ->
            val converters = context.getBean(RestTemplateBuilder::class.java).build().messageConverters

            assertJackson2First(converters, context.getBean(ObjectMapper::class.java))
        }
    }

    @Test
    fun `RestClient sends JSON written by the Jackson 2 mapper`() {
        contextRunner.run { context ->
            val objectMapper = context.getBean(ObjectMapper::class.java)
            val builder = context.getBean(RestClient.Builder::class.java)
            val server = MockRestServiceServer.bindTo(builder).build()
            val body = mapOf("date" to Date(0), "node" to objectMapper.createObjectNode().put("a", 1))
            server.expect(requestTo("http://example.test/"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(objectMapper.writeValueAsString(body)))
                .andRespond(withSuccess())

            builder.build().post().uri("http://example.test/").contentType(APPLICATION_JSON).body(body)
                .retrieve().toBodilessEntity()

            server.verify()
        }
    }

    private fun assertJackson2First(converters: List<HttpMessageConverter<*>>, objectMapper: ObjectMapper) {
        val jackson2 = converters.filterIsInstance<MappingJackson2HttpMessageConverter>()
        assertThat(jackson2).hasSize(1)
        assertThat(jackson2.single().objectMapper).isSameAs(objectMapper)

        val firstJsonWriter = converters.first { it.canWrite(Map::class.java, APPLICATION_JSON) }
        assertThat(firstJsonWriter).isSameAs(jackson2.single())

        val jackson3Index = converters.indexOfFirst { it is JacksonJsonHttpMessageConverter }
        if (jackson3Index >= 0) {
            assertThat(jackson3Index).isGreaterThan(converters.indexOf(jackson2.single()))
        }
    }
}
