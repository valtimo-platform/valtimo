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

import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class MapperSingletonTest {

    @Test
    fun `default mapper should read untyped JSON into Java collections`() {
        val value = MapperSingleton.createDefault().readValue<Map<String, Any>>("""{"list":[1],"map":{"a":1}}""")

        assertIs<java.util.List<*>>(value["list"])
        assertIs<java.util.Map<*, *>>(value["map"])
    }

    @Test
    fun `default mapper should register service-loaded modules except Scala`() {
        val moduleIds = MapperSingleton.createDefault().registeredModuleIds.map { it.toString() }

        assertTrue(moduleIds.any { it.contains("KotlinModule") }, moduleIds.toString())
        assertFalse(moduleIds.any { it.contains("scala", ignoreCase = true) }, moduleIds.toString())
    }
}
