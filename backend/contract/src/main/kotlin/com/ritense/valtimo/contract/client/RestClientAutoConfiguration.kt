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

package com.ritense.valtimo.contract.client

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.restclient.RestClientCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Profile
import org.springframework.boot.autoconfigure.AutoConfigureBefore
import org.springframework.boot.webmvc.autoconfigure.WebMvcAutoConfiguration
import org.springframework.http.converter.HttpMessageConverter
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@AutoConfiguration
@AutoConfigureBefore(WebMvcAutoConfiguration::class)
@EnableConfigurationProperties(ValtimoHttpRestClientConfigurationProperties::class)
class RestClientAutoConfiguration {

    @Bean
    fun jackson2HttpMessageConverter(objectMapper: ObjectMapper): MappingJackson2HttpMessageConverter {
        return MappingJackson2HttpMessageConverter(objectMapper)
    }

    @Bean
    fun jackson2RestClientCustomizer(jackson2HttpMessageConverter: MappingJackson2HttpMessageConverter): RestClientCustomizer {
        return RestClientCustomizer { restClientBuilder ->
            restClientBuilder.messageConverters { converters ->
                addJackson2BeforeJackson3(converters, jackson2HttpMessageConverter)
            }
        }
    }

    @Bean
    fun jackson2WebMvcConfigurer(jackson2HttpMessageConverter: MappingJackson2HttpMessageConverter): WebMvcConfigurer {
        return object : WebMvcConfigurer {
            override fun extendMessageConverters(converters: MutableList<HttpMessageConverter<*>>) {
                addJackson2BeforeJackson3(converters, jackson2HttpMessageConverter)
            }
        }
    }

    private fun addJackson2BeforeJackson3(
        converters: MutableList<HttpMessageConverter<*>>,
        jackson2Converter: MappingJackson2HttpMessageConverter
    ) {
        val jackson3Index = converters.indexOfFirst {
            it.javaClass.name == "org.springframework.http.converter.json.JacksonJsonHttpMessageConverter"
        }
        if (jackson3Index >= 0) {
            converters.add(jackson3Index, jackson2Converter)
        } else {
            converters.add(jackson2Converter)
        }
    }

    @Bean
    fun requestFactoryCustomizer(
        valtimoHttpRestClientConfigurationProperties: ValtimoHttpRestClientConfigurationProperties
    ): ApacheRequestFactoryCustomizer {
        return ApacheRequestFactoryCustomizer(valtimoHttpRestClientConfigurationProperties)
    }

    @Bean
    @ConditionalOnMissingBean(HostDockerInternalRestClientCustomizer::class)
    @ConditionalOnProperty(value = ["valtimo.docker.filter.enabled"], havingValue = "true", matchIfMissing = false)
    fun hostDockerInternalRestClientCustomizer(
        @Value("\${valtimo.docker.filter.ports:8001,8002,8003,8006,8010,8011}") dockerPorts: List<String>,
        @Value("\${valtimo.docker.filter.rewriteRequestHost:false}") rewriteRequestHost: Boolean,
        @Value("\${server.port:8080}") webServerPort: Int,
    ): HostDockerInternalRestClientCustomizer {
        return HostDockerInternalRestClientCustomizer(
            dockerPorts.map { it.toInt() },
            rewriteRequestHost,
            webServerPort,
        )
    }

    @Bean
    @ConditionalOnMissingBean(HostDockerInternalRestClientCustomizer::class)
    @Profile("dev")
    @ConditionalOnProperty(value = ["valtimo.docker.filter.enabled"], havingValue = "true", matchIfMissing = true)
    fun devHostDockerInternalRestClientCustomizer(
        @Value("\${valtimo.docker.filter.ports:8001,8002,8003,8006,8010,8011}") dockerPorts: List<String>,
        @Value("\${valtimo.docker.filter.rewriteRequestHost:false}") rewriteRequestHost: Boolean,
        @Value("\${server.port:8080}") webServerPort: Int,
    ): HostDockerInternalRestClientCustomizer {
        return HostDockerInternalRestClientCustomizer(
            dockerPorts.map { it.toInt() },
            rewriteRequestHost,
            webServerPort,
        )
    }
}