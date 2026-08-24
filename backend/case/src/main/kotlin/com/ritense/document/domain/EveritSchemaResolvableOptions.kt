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
            containerSelfOption(prefix, path) +
                propertySchemas.flatMap { (key, sub) ->
                    sub.walkValueResolverOptions(prefix, "$path/$key", depth + 1, visitedReferences)
                }

        // An array is offered **twice, at the same path**, because the two option types answer different
        // questions and a caller only ever sees one of them: `getResolvableKeys` filters the flat list by the
        // requested type, so a picker asking for FIELD gets the container and one asking for COLLECTION gets
        // the iterable with its item fields. The COLLECTION half drives the collection and table widgets — pick
        // an array, then a field within its items. The FIELD half exists for the same reason an object node is
        // offered alongside its properties: `doc:/kinderen` resolves to the whole array, so it is a value a
        // migration patch can copy or clear and a condition can test, and without it every array in a document
        // was simply unreachable from every FIELD-typed picker in the application.
        is ArraySchema -> containerSelfOption(prefix, path) + listOf(
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

        // Deduplicated by path **and type**, not by path alone. `oneOf`/`anyOf` branches describe the same
        // node, so they legitimately produce the same path more than once and only one copy is wanted — but
        // two options that differ in type are two different answers, not a duplicate, and collapsing them
        // silently discards one. A node declared `oneOf: [array, string]` (or `type: ["array", "string"]`)
        // is both a collection and a field, and which of the two survived was decided by nothing better than
        // which branch the schema author happened to write first. That also made the array option added
        // above unreachable under a combined schema, where it would have been collapsed straight back into
        // the string branch's field option. Residual, and deliberately left: two branches yielding the same
        // path *and* type with different children still resolve to whichever comes first.
        is CombinedSchema ->
            subschemas.flatMap { it.walkValueResolverOptions(prefix, path, depth + 1, visitedReferences) }
                .distinctBy { it.path to it.type }

        is StringSchema, is NumberSchema, is BooleanSchema, is EnumSchema, is ConstSchema ->
            listOf(ValueResolverOption("$prefix$path", FIELD))

        else -> emptyList()
    }
}

/**
 * A container node — an object or an array — is offered as a [FIELD] option so it shows up in the (field-typed)
 * value path pickers, allowing a whole subtree to be resolved at once. The root container (empty [path]) is not
 * selectable.
 */
private fun containerSelfOption(prefix: String, path: String): List<ValueResolverOption> =
    if (path.isEmpty()) emptyList() else listOf(ValueResolverOption("$prefix$path", FIELD))

private val logger = KotlinLogging.logger {}
