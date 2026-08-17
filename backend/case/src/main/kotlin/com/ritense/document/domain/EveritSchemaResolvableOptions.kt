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
import io.github.oshai.kotlinlogging.KotlinLogging
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
    walkValueResolverOptions(prefix, "", 0, emptyList())

/**
 * @param depth how many schema levels have been descended into already, guarded by [MAX_SCHEMA_DEPTH] so a
 * recursive schema does not cause a `StackOverflowError`.
 * @param visitedReferences the `$ref` schemas on the path from the root to this schema. A recursive `$ref` (one
 * that points back at an ancestor) is not followed a second time, since it would otherwise expand endlessly.
 */
private fun Schema.walkValueResolverOptions(
    prefix: String,
    path: String,
    depth: Int,
    visitedReferences: List<ReferenceSchema>
): List<ValueResolverOption> {
    if (depth > MAX_SCHEMA_DEPTH) {
        logger.warn {
            "Stopped collecting value resolver options at '$prefix$path'. " +
                "The schema is nested deeper than $MAX_SCHEMA_DEPTH levels."
        }
        return emptyList()
    }
    return when (this) {
        is ObjectSchema ->
            // The root schema itself (empty path) is not a selectable option, but every nested object node is,
            // so a whole subtree can be selected (e.g. doc:/applicant) in addition to its individual leaf properties.
            objectSelfOption(prefix, path) +
                propertySchemas.flatMap { (key, sub) ->
                    sub.walkValueResolverOptions(prefix, "$path/$key", depth + 1, visitedReferences)
                }

        is ArraySchema -> listOf(
            ValueResolverOption(
                "$prefix$path",
                COLLECTION,
                allItemSchema?.walkValueResolverOptions("", "", depth + 1, visitedReferences).orEmpty()
            )
        )

        is ReferenceSchema -> {
            val reference = this
            if (visitedReferences.any { it === reference }) {
                emptyList()
            } else {
                referredSchema?.walkValueResolverOptions(
                    prefix,
                    path,
                    depth + 1,
                    visitedReferences + reference
                ).orEmpty()
            }
        }

        is CombinedSchema ->
            subschemas.flatMap { it.walkValueResolverOptions(prefix, path, depth + 1, visitedReferences) }
                .distinctBy { it.path }

        is StringSchema, is NumberSchema, is BooleanSchema, is EnumSchema, is ConstSchema ->
            listOf(ValueResolverOption("$prefix$path", FIELD))

        else -> emptyList()
    }
}

/**
 * An object container node is offered as a [FIELD] option so it shows up in the (field-typed) value path pickers,
 * allowing a whole subtree to be resolved at once. The root object (empty [path]) is not selectable.
 */
private fun objectSelfOption(prefix: String, path: String): List<ValueResolverOption> =
    if (path.isEmpty()) emptyList() else listOf(ValueResolverOption("$prefix$path", FIELD))

private val logger = KotlinLogging.logger {}
