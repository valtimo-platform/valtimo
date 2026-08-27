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

package com.ritense.document.domain

import com.fasterxml.jackson.core.JsonPointer
import io.github.oshai.kotlinlogging.KotlinLogging
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.ValidationException
import org.json.JSONObject

enum class NullWriteStrategy {
    WRITE_NULL,
    REMOVE,
    NOT_ALLOWED,
}

fun Schema.determineNullWriteStrategy(jsonPointer: String): NullWriteStrategy {
    if (getProperty(jsonPointer)?.allowsNull() == true) {
        return NullWriteStrategy.WRITE_NULL
    }
    return when (allowsRemovalOf(JsonPointer.compile(jsonPointer))) {
        true -> NullWriteStrategy.REMOVE
        false -> NullWriteStrategy.NOT_ALLOWED
        null -> NullWriteStrategy.WRITE_NULL
    }
}

private fun Schema.allowsNull(): Boolean {
    return try {
        validate(JSONObject.NULL)
        true
    } catch (_: ValidationException) {
        false
    }
}

private fun Schema.allowsRemovalOf(jsonPointer: JsonPointer): Boolean? {
    val propertyName = jsonPointer.last()?.matchingProperty ?: return null
    val parentPointer = jsonPointer.head()?.toString().orEmpty()
    val parentSchema = if (parentPointer.isEmpty()) this else getProperty(parentPointer)
    return parentSchema?.permitsRemovalOf(propertyName)
}

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
