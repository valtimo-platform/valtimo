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

package com.ritense.document.domain

import com.ritense.valueresolver.ValueResolverOption
import com.ritense.valueresolver.ValueResolverOptionType.COLLECTION
import com.ritense.valueresolver.ValueResolverOptionType.FIELD
import org.everit.json.schema.ArraySchema
import org.everit.json.schema.BooleanSchema
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ConstSchema
import org.everit.json.schema.EnumSchema
import org.everit.json.schema.NumberSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema

/**
 * Walks the typed everit [Schema] tree and produces the list of resolvable options.
 */
@JvmOverloads
fun Schema.collectValueResolverOptions(prefix: String = ""): List<ValueResolverOption> =
    walkValueResolverOptions(prefix, "")

private fun Schema.walkValueResolverOptions(prefix: String, path: String): List<ValueResolverOption> {
    return when (this) {
        is ObjectSchema ->
            propertySchemas.flatMap { (key, sub) -> sub.walkValueResolverOptions(prefix, "$path/$key") }

        is ArraySchema -> listOf(
            ValueResolverOption("$prefix$path", COLLECTION, allItemSchema?.collectValueResolverOptions().orEmpty())
        )

        is ReferenceSchema ->
            referredSchema?.walkValueResolverOptions(prefix, path).orEmpty()

        is CombinedSchema ->
            subschemas.flatMap { it.walkValueResolverOptions(prefix, path) }.distinctBy { it.path }

        is StringSchema, is NumberSchema, is BooleanSchema, is EnumSchema, is ConstSchema ->
            listOf(ValueResolverOption("$prefix$path", FIELD))

        else -> emptyList()
    }
}
