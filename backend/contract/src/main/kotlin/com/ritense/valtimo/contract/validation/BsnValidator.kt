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

package com.ritense.valtimo.contract.validation

object BsnValidator {

    private val elfProefWeights = intArrayOf(9, 8, 7, 6, 5, 4, 3, 2, -1)
    private val bsnRegex = Regex("^\\d{8,9}$")

    fun isValid(bsn: String?): Boolean {
        if (bsn.isNullOrBlank()) return false
        if (!bsnRegex.matches(bsn)) return false
        if (bsn.all { it == '0' }) return false

        val normalizedBsn = bsn.padStart(9, '0')
        return passesElfProef(normalizedBsn)
    }

    private fun passesElfProef(value: String): Boolean {
        var result = 0
        for (i in elfProefWeights.indices) {
            val digit = value[i] - '0'
            result += digit * elfProefWeights[i]
        }
        return result % 11 == 0
    }
}
