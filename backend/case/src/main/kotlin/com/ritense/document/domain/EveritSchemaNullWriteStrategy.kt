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

import com.fasterxml.jackson.core.JsonPointer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.ValidationException
import org.json.JSONObject

/** The way a 'null' value should be written for a property, based on the document schema. */
enum class NullWriteStrategy {
    /** The schema allows a null value at this location; write JSON null. */
    WRITE_NULL,

    /** Null is not allowed, but the property is not required; remove the node. */
    REMOVE,

    /** Null is not allowed and the property is required; it can neither be set to null nor removed. */
    NOT_ALLOWED,
}

/**
 * Determines how a 'null' value should be written for the property at [jsonPointer], based on this (root) schema.
 *
 * @param jsonPointer a JSON pointer (e.g. `/address/street`) pointing to the property being written.
 */
fun Schema.determineNullWriteStrategy(jsonPointer: String): NullWriteStrategy {
    val subSchema = getProperty(jsonPointer)
    if (subSchema != null && subSchema.allowsNull()) {
        return NullWriteStrategy.WRITE_NULL
    }
    return if (allowsRemovalOf(JsonPointer.compile(jsonPointer))) {
        NullWriteStrategy.REMOVE
    } else {
        NullWriteStrategy.NOT_ALLOWED
    }
}

/** Validates a JSON null against this schema; returns true when it is accepted. */
private fun Schema.allowsNull(): Boolean {
    return try {
        validate(JSONObject.NULL)
        true
    } catch (e: ValidationException) {
        false
    }
}

/** A property may be removed when its parent object schema does not require it. */
private fun Schema.allowsRemovalOf(jsonPointer: JsonPointer): Boolean {
    val propertyName = jsonPointer.last()?.matchingProperty ?: return false
    val parentPointer = jsonPointer.head()?.toString().orEmpty()
    val parentSchema = if (parentPointer.isEmpty()) this else getProperty(parentPointer)
    return parentSchema?.permitsRemovalOf(propertyName) ?: false
}

/**
 * Whether the parent schema this is called on allows [propertyName] to be absent, or null when it says
 * nothing about the matter (it is not, and does not wrap, an object schema).
 *
 * Every branch of a combined schema is consulted rather than the first one that happens to be an object,
 * because which branch that was depended on the order the author wrote them in: a parent declared
 * `oneOf: [{required: [v]}, {}]` reported `v` as un-removable when the requiring branch came first and
 * removable when it came second. The criterion decides how the branches combine, which is the same rule
 * validation itself applies — under `allOf` the value has to satisfy every branch, so the property may only
 * go if **all** of them permit it; under `anyOf` / `oneOf` satisfying **one** branch is enough, and a
 * document that drops the property is still valid as long as some branch does not require it.
 *
 * @param depth how many schema levels have been descended into already, guarded by [MAX_SCHEMA_DEPTH] so a
 * recursive schema does not cause a `StackOverflowError`.
 */
private fun Schema.permitsRemovalOf(propertyName: String, depth: Int = 0): Boolean? {
    if (depth > MAX_SCHEMA_DEPTH) {
        logger.warn { "Stopped unwrapping the object schema. The schema is nested deeper than $MAX_SCHEMA_DEPTH levels." }
        return null
    }
    return when (this) {
        is ObjectSchema -> !requiredProperties.contains(propertyName)
        is ReferenceSchema -> referredSchema?.permitsRemovalOf(propertyName, depth + 1)
        is CombinedSchema -> {
            val answers = subschemas.mapNotNull { it.permitsRemovalOf(propertyName, depth + 1) }
            when {
                answers.isEmpty() -> null
                criterion == CombinedSchema.ALL_CRITERION -> answers.all { it }
                else -> answers.any { it }
            }
        }

        else -> null
    }
}

private val logger = KotlinLogging.logger {}
