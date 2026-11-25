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

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.http.converter.autoconfigure.HttpMessageConvertersAutoConfiguration
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration
import org.springframework.boot.jackson2.autoconfigure.Jackson2AutoConfiguration
import org.springframework.boot.test.context.runner.WebApplicationContextRunner
import org.springframework.boot.webmvc.autoconfigure.WebMvcAutoConfiguration
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.util.Date
import java.util.TimeZone
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue

@Suppress("DEPRECATION")
class SpringJacksonPropertiesTest {

    private lateinit var originalMapper: ObjectMapper

    private val contextRunner = WebApplicationContextRunner()
        .withConfiguration(
            AutoConfigurations.of(
                JacksonAutoConfiguration::class.java,
                Jackson2AutoConfiguration::class.java,
                SpringJacksonPropertiesAutoConfiguration::class.java,
                HttpMessageConvertersAutoConfiguration::class.java,
                WebMvcAutoConfiguration::class.java,
            )
        )
        .withUserConfiguration(MapperSingletonAutoConfiguration::class.java, DateController::class.java)
        .withPropertyValues("spring.http.converters.preferred-json-mapper=jackson2")

    @BeforeEach
    fun saveMapperSingleton() {
        originalMapper = MapperSingleton.get()
    }

    @AfterEach
    fun restoreMapperSingleton() {
        MapperSingleton.set(originalMapper)
    }

    @Test
    fun `should apply spring jackson properties to the Jackson 2 mapper`() {
        contextRunner
            .withPropertyValues(
                "spring.jackson.date-format=yyyy-MM-dd HH:mm",
                "spring.jackson.time-zone=GMT+02:00",
                "spring.jackson.serialization.indent-output=true",
                "spring.jackson.deserialization.fail-on-unknown-properties=false",
            )
            .run { context ->
                val mapper = context.getBean(ObjectMapper::class.java)

                assertSame(mapper, MapperSingleton.get())
                assertEquals(TimeZone.getTimeZone("GMT+02:00"), mapper.serializationConfig.timeZone)
                assertTrue(mapper.isEnabled(SerializationFeature.INDENT_OUTPUT))
                assertFalse(mapper.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
                assertEquals("\"1970-01-01 02:00\"", mapper.writeValueAsString(Date(0)))
            }
    }

    @Test
    fun `should apply spring jackson properties to MVC responses`() {
        contextRunner
            .withPropertyValues(
                "spring.jackson.date-format=yyyy-MM-dd HH:mm",
                "spring.jackson.time-zone=GMT+02:00",
            )
            .run { context ->
                MockMvcBuilders.webAppContextSetup(context).build()
                    .get("/date")
                    .andExpect {
                        status { isOk() }
                        jsonPath("$.date") { value("1970-01-01 02:00") }
                    }
            }
    }

    @Test
    fun `should prefer spring jackson2 properties over spring jackson properties`() {
        contextRunner
            .withPropertyValues(
                "spring.jackson.serialization.indent-output=true",
                "spring.jackson2.serialization.indent-output=false",
            )
            .run { context ->
                assertFalse(context.getBean(ObjectMapper::class.java).isEnabled(SerializationFeature.INDENT_OUTPUT))
            }
    }

    @RestController
    class DateController {
        @GetMapping("/date")
        fun date() = mapOf("date" to Date(0))
    }
}
