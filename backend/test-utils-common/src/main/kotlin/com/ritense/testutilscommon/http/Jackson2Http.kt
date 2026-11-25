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

package com.ritense.testutilscommon.http

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.json.MapperSingleton
import org.springframework.http.converter.HttpMessageConverters
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestTemplate

/**
 * Bare Spring 7 builders pick Jackson 3. Production gets Jackson 2 through Boot's beans
 * (`spring.http.converters.preferred-json-mapper=jackson2`); these give tests the same converters.
 * Remove together with the Jackson 2 bridge.
 */
object Jackson2Http {

    @JvmStatic
    @JvmOverloads
    fun restClientBuilder(objectMapper: ObjectMapper = MapperSingleton.get()): RestClient.Builder =
        RestClient.builder().configureMessageConverters {
            it.registerDefaults().withJsonConverter(MappingJackson2HttpMessageConverter(objectMapper))
        }

    @JvmStatic
    @JvmOverloads
    fun restTemplate(objectMapper: ObjectMapper = MapperSingleton.get()): RestTemplate =
        RestTemplate(
            HttpMessageConverters.forClient()
                .registerDefaults()
                .withJsonConverter(MappingJackson2HttpMessageConverter(objectMapper))
                .build()
                .toList()
        )

    @JvmStatic
    @JvmOverloads
    fun serverConverters(objectMapper: ObjectMapper = MapperSingleton.get()) =
        HttpMessageConverters.forServer()
            .registerDefaults()
            .withJsonConverter(MappingJackson2HttpMessageConverter(objectMapper))
            .build()
            .toList()
            .toTypedArray()
}
