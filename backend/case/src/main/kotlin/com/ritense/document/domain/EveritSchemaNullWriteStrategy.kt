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
    val objectSchema = parentSchema?.unwrapObjectSchema() ?: return false
    return !objectSchema.requiredProperties.contains(propertyName)
}

/**
 * @param depth how many schema levels have been descended into already, guarded by [MAX_SCHEMA_DEPTH] so a
 * recursive schema does not cause a `StackOverflowError`.
 */
private fun Schema.unwrapObjectSchema(depth: Int = 0): ObjectSchema? {
    if (depth > MAX_SCHEMA_DEPTH) {
        logger.warn { "Stopped unwrapping the object schema. The schema is nested deeper than $MAX_SCHEMA_DEPTH levels." }
        return null
    }
    return when (this) {
        is ObjectSchema -> this
        is ReferenceSchema -> referredSchema?.unwrapObjectSchema(depth + 1)
        is CombinedSchema -> subschemas.firstNotNullOfOrNull { it.unwrapObjectSchema(depth + 1) }
        else -> null
    }
}

private val logger = KotlinLogging.logger {}
