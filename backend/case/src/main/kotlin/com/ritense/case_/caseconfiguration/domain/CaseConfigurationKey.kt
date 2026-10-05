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

package com.ritense.case_.caseconfiguration.domain

object CaseConfigurationKey {
    const val MAX_KEY_LENGTH = 255
    const val MAX_VALUE_LENGTH = 4000
    private val KEY_PATTERN = Regex("^\\S+$")

    fun validate(key: String) {
        require(key.isNotBlank()) { "Configuration key was blank!" }
        require(KEY_PATTERN.matches(key)) { "Configuration key '$key' may not contain whitespace" }
        require(key.length <= MAX_KEY_LENGTH) { "Configuration key '$key' is longer than $MAX_KEY_LENGTH characters" }
    }

    fun validateValue(value: String?) {
        require(value == null || value.length <= MAX_VALUE_LENGTH) {
            "Configuration value is longer than $MAX_VALUE_LENGTH characters"
        }
    }
}
