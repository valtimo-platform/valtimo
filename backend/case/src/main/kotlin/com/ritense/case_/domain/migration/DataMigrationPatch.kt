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

package com.ritense.case_.domain.migration

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * A single data-migration instruction. Value resolvers only; there are two forms:
 *
 * - copy: [source] value resolver copied to [target].
 * - set:  literal [value] written to [target].
 *
 * [targetType] optionally coerces the written value before it is validated against the target
 * document schema.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class DataMigrationPatch(
    val source: String? = null,
    val value: Any? = null,
    val target: String,
    val targetType: String? = null,
)
