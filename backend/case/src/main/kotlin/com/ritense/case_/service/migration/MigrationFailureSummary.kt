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

package com.ritense.case_.service.migration

/**
 * The one line worth showing for a failed case. A migration failure is stored as a whole stack trace, and
 * its top frame is the generic wrapper — the schema rule that actually refused the case sits in the last
 * `Caused by`, thousands of characters down. Derived from the stored text rather than recorded beside it,
 * so rows written before this existed read the same.
 */
object MigrationFailureSummary {

    private val CAUSED_BY = Regex("^Caused by: (.+)$", RegexOption.MULTILINE)

    fun of(stackTrace: String?): String? {
        if (stackTrace.isNullOrBlank()) return null
        val rootCause = CAUSED_BY.findAll(stackTrace).lastOrNull()?.groupValues?.get(1)
        return (rootCause ?: stackTrace.lineSequence().firstOrNull { it.isNotBlank() })
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
    }
}
