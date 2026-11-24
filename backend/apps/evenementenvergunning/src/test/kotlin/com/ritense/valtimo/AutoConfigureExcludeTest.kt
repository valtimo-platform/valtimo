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

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean
import org.springframework.core.io.ClassPathResource
import org.springframework.util.ClassUtils
import kotlin.test.assertTrue

class AutoConfigureExcludeTest {

    @Test
    fun `excluded auto-configurations exist on the classpath`() {
        val yaml = YamlPropertiesFactoryBean().apply {
            setResources(ClassPathResource("config/application.yml"))
        }.`object` ?: error("config/application.yml not found")
        val excluded = yaml.stringPropertyNames()
            .filter { it.startsWith("spring.autoconfigure.exclude") }
            .map { yaml.getProperty(it) }

        assertTrue(excluded.isNotEmpty())
        val missing = excluded.filterNot { ClassUtils.isPresent(it, javaClass.classLoader) }
        assertTrue(missing.isEmpty(), "spring.autoconfigure.exclude entries not on the classpath: $missing")
    }
}
