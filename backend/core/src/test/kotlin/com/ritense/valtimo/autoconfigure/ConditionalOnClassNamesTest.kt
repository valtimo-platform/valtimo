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


package com.ritense.valtimo.autoconfigure

import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.util.ClassUtils
import kotlin.test.assertTrue

class ConditionalOnClassNamesTest {

    @Test
    fun `class names in ConditionalOnClass resolve on the classpath`() {
        val names = ValtimoAutoConfiguration::class.java.declaredMethods
            .mapNotNull { it.getAnnotation(ConditionalOnClass::class.java) }
            .flatMap { it.name.toList() }

        assertTrue(names.isNotEmpty())
        val missing = names.filterNot { ClassUtils.isPresent(it, javaClass.classLoader) }
        assertTrue(missing.isEmpty(), "ConditionalOnClass names not on the classpath: $missing")
    }
}
