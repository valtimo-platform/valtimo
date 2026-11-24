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


package com.ritense.document.opensearch.autoconfigure

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurationMetadata

class ExcludeElasticsearchAutoConfigurationFilterTest {

    @Test
    fun `every excluded name is a registered Spring Boot auto-configuration`() {
        val registered = registeredAutoConfigurations()

        val unknown = ExcludeElasticsearchAutoConfigurationFilter.EXCLUDED_AUTO_CONFIGURATIONS - registered

        assertThat(unknown).`as`("Names not found in any AutoConfiguration.imports").isEmpty()
    }

    @Test
    fun `filter vetoes only the excluded names`() {
        val metadata = org.mockito.Mockito.mock(AutoConfigurationMetadata::class.java)
        val excluded = ExcludeElasticsearchAutoConfigurationFilter.EXCLUDED_AUTO_CONFIGURATIONS.first()
        val other = "com.ritense.SomeAutoConfiguration"

        val result = ExcludeElasticsearchAutoConfigurationFilter().match(arrayOf(excluded, other), metadata)

        assertThat(result.toList()).containsExactly(false, true)
    }

    private fun registeredAutoConfigurations(): Set<String> =
        javaClass.classLoader.getResources(AUTO_CONFIGURATION_IMPORTS).toList()
            .flatMap { it.readText().lines() }
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .toSet()

    companion object {
        private const val AUTO_CONFIGURATION_IMPORTS =
            "META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports"
    }
}
