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

package com.ritense.valtimo

import com.ritense.valtimo.contract.json.MapperSingleton
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.web.client.RestClient

object Jackson2TestUtils {

    private val jackson2Converter = MappingJackson2HttpMessageConverter(MapperSingleton.get())

    fun restClientBuilder(): RestClient.Builder =
        RestClient.builder().messageConverters { converters ->
            converters.addFirst(jackson2Converter)
        }

    fun jackson2Converter(): MappingJackson2HttpMessageConverter = jackson2Converter
}
