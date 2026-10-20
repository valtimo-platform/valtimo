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

package com.ritense.dataprovider.defaultdataproviders.providers

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.DefaultResourceLoader

class ClasspathJsonResourceResolverTest {

    private val resourceLoader = DefaultResourceLoader()

    @ParameterizedTest
    @CsvSource(
        "user-dropdown-list, config/dropdown/user-dropdown-list.json",
        "my.list, config/dropdown/my.list.json",
        "sub/list, config/dropdown/sub/list.json",
        "sub/../list, config/dropdown/list.json",
    )
    fun `should resolve key inside base directory`(key: String, expectedPath: String) {
        val resource = resolveClasspathJsonResource(resourceLoader, BASE_DIR, key)

        assertEquals(expectedPath, (resource as ClassPathResource).path)
    }

    @ParameterizedTest
    @ValueSource(
        strings = [
            "../x",
            "../../x",
            "../../../x",
            "..\\..\\x",
            "sub/../../x",
            "../dropdown-evil/x",
            "../dropdown",
        ]
    )
    fun `should not resolve key outside base directory`(key: String) {
        assertNull(resolveClasspathJsonResource(resourceLoader, BASE_DIR, key))
    }

    companion object {
        private const val BASE_DIR = "config/dropdown"
    }
}
