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

package com.ritense.extension.listener

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.extension.ExtensionNeedsRestartCheck
import jakarta.persistence.Entity
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class OnJpaEntityExtensionNeedsRestart : ExtensionNeedsRestartCheck {

    override fun needsRestart(extensionClasses: List<Class<*>>): Boolean {
        return extensionClasses.any { isJpaEntity(it) }
    }

    private fun isJpaEntity(clazz: Class<*>): Boolean {
        return (getAllInterfaces(clazz) + clazz)
            .flatMap { it.annotations.toList() }
            .map { it.annotationClass }
            .any { it == Entity::class }
    }

    private fun getAllInterfaces(clazz: Class<*>): List<Class<*>> {
        val interfaces = (clazz.interfaces + clazz.superclass).filterNotNull().toMutableList()
        val iterator = interfaces.listIterator()
        while (iterator.hasNext()) {
            val i = iterator.next()
            (i.interfaces + i.superclass)
                .filterNotNull()
                .filter { !interfaces.contains(it) }
                .forEach { iterator.add(it) }
        }
        return interfaces
    }

}