/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.helper

object MapHelper {

    fun <T> Map<T, Any?>.deepMerge(other: Map<T, Any?>): Map<T, Any?> =
        this.toMutableMap().apply {
            other.forEach { (key, value) ->
                val existing = this[key]
                if (existing is Map<*, *> && value is Map<*, *>) {
                    @Suppress("UNCHECKED_CAST")
                    this[key] = (existing as Map<String, Any>).deepMerge(value as Map<String, Any>)
                } else {
                    this[key] = value
                }
            }
        }

}
