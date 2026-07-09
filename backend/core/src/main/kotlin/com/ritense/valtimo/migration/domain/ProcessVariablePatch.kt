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

package com.ritense.valtimo.migration.domain

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * A single `setProcessVariables` instruction: the process variable named [target] is set on the
 * migrated process instance. Value resolvers only; two forms:
 *
 * - copy: the [source] value resolver path (e.g. `pv:/foo`, `doc:/emailadres`) resolved against the
 *   migrating case is copied to the [target] variable.
 * - set:  the literal [value] is written to the [target] variable.
 *
 * [targetType] optionally coerces the value before it is set.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ProcessVariablePatch(
    val source: String? = null,
    val value: Any? = null,
    val target: String,
    val targetType: String? = null,
)
