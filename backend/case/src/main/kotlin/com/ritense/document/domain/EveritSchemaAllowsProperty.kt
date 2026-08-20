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

import io.github.oshai.kotlinlogging.KotlinLogging
import org.everit.json.schema.ArraySchema
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.JSONPointer
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.ValidationException
import org.everit.json.schema.regexp.Regexp

/** This method is a copy from org.everit.json.schema.Schema.definesProperty(.) but returns true when the schema allows additionalProperties */
fun Schema.allowsProperty(field: String): Boolean = allowsProperty(field, 0)

/**
 * @param depth how many schema levels have been descended into already, guarded by [MAX_SCHEMA_DEPTH] so a
 * recursive schema does not cause a `StackOverflowError`.
 */
private fun Schema.allowsProperty(field: String, depth: Int): Boolean {
    if (depth > MAX_SCHEMA_DEPTH) {
        logger.warn { "Stopped checking whether property '$field' is allowed. The schema is nested deeper than $MAX_SCHEMA_DEPTH levels." }
        return false
    }
    return when (this) {
        is ObjectSchema -> allowsProperty(field, depth)
        is ArraySchema -> allowsProperty(field, depth)
        is CombinedSchema -> allowsProperty(field, depth)
        is ReferenceSchema -> allowsProperty(field, depth)
        else -> false
    }
}

/** Copied from ObjectSchema.definesProperty(.) but returns true when the schema allows additionalProperties */
private fun ObjectSchema.allowsProperty(field: String, depth: Int): Boolean {
    val headAndTail: Array<String?> = headAndTailOfJsonPointerFragment(field)
    val nextToken = headAndTail[0]!!
    val remaining = headAndTail[1]
    val field2 = headAndTail[2]!!
    return field2.isNotEmpty() && (allowsSchemaProperty(nextToken, remaining, depth)
            || allowsPatternProperty(nextToken, remaining, depth)
            || allowsSchemaDependencyProperty(field2, depth)
            || permitsAdditionalProperties()) // <- This is the only line that is different from all definesProperty(.) implementations
}

/** Copied from ObjectSchema.definesSchemaProperty(.) but returns true when the schema allows additionalProperties */
private fun ObjectSchema.allowsSchemaProperty(current: String, remaining: String?, depth: Int): Boolean {
    val currentUnescaped = jsonPointerUnescape(current)
    return if (propertySchemas.containsKey(currentUnescaped)) {
        if (remaining != null) {
            propertySchemas[currentUnescaped]!!.allowsProperty(remaining, depth + 1)
        } else {
            true
        }
    } else false
}

/** Copied from ObjectSchema.definesPatternProperty(.) but returns true when the schema allows additionalProperties */
private fun ObjectSchema.allowsPatternProperty(current: String, remaining: String?, depth: Int): Boolean {
    val patternProperties: Map<Regexp, Schema> = getPrivateField("patternProperties")
    patternProperties.entries.forEach { (pattern, value) ->
        if (!pattern.patternMatchingFailure(current).isPresent
            && (remaining == null || value.allowsProperty(remaining, depth + 1))
        ) {
            return true
        }
    }
    return false
}

/** Copied from ObjectSchema.definesSchemaDependencyProperty(.) but returns true when the schema allows additionalProperties */
private fun ObjectSchema.allowsSchemaDependencyProperty(field: String, depth: Int): Boolean {
    if (schemaDependencies.containsKey(field)) {
        return true
    }
    for (schema in schemaDependencies.values) {
        if (schema.allowsProperty(field, depth + 1)) {
            return true
        }
    }
    return false
}

/** Copied from ArraySchema.definesProperty(.) but returns true when the schema allows additionalProperties */
private fun ArraySchema.allowsProperty(field: String, depth: Int): Boolean {
    val headAndTail: Array<String?> = headAndTailOfJsonPointerFragment(field)
    val nextToken = headAndTail[0]!!
    val remaining = headAndTail[1]
    val hasRemaining = remaining != null
    return try {
        tryPropertyDefinitionByNumericIndex(nextToken, remaining, hasRemaining, depth)
    } catch (e: NumberFormatException) {
        tryPropertyDefinitionByMetaIndex(nextToken, remaining, hasRemaining, depth)
    }
}


/** Copied from ArraySchema.tryPropertyDefinitionByMetaIndex(.) but returns true when the schema allows additionalProperties */
private fun ArraySchema.tryPropertyDefinitionByMetaIndex(
    nextToken: String,
    remaining: String?,
    hasRemaining: Boolean,
    depth: Int
): Boolean {
    val isAll = "all" == nextToken
    val isAny = "any" == nextToken
    if (!hasRemaining && (isAll || isAny)) {
        return true
    }
    if (isAll) {
        return if (allItemSchema != null) {
            allItemSchema.allowsProperty(remaining!!, depth + 1)
        } else {
            val allItemSchemasDefine: Boolean = itemSchemas.stream()
                .map { schema -> schema.allowsProperty(remaining!!, depth + 1) }
                .reduce(true) { a, b -> java.lang.Boolean.logicalAnd(a, b) }
            if (allItemSchemasDefine) {
                return if (schemaOfAdditionalItems != null) {
                    schemaOfAdditionalItems.allowsProperty(remaining!!, depth + 1)
                } else {
                    true
                }
            }
            false
        }
    } else if (isAny) {
        return if (allItemSchema != null) {
            allItemSchema.allowsProperty(remaining!!, depth + 1)
        } else {
            val anyItemSchemasDefine: Boolean = itemSchemas.stream()
                .map { schema -> schema.allowsProperty(remaining!!, depth + 1) }
                .reduce(false) { a, b -> java.lang.Boolean.logicalOr(a, b) }
            anyItemSchemasDefine || schemaOfAdditionalItems == null ||
                    schemaOfAdditionalItems.allowsProperty(remaining!!, depth + 1)
        }
    }
    return false
}

/** Copied from ArraySchema.tryPropertyDefinitionByNumericIndex(.) but returns true when the schema allows additionalProperties */
private fun ArraySchema.tryPropertyDefinitionByNumericIndex(
    nextToken: String,
    remaining: String?,
    hasRemaining: Boolean,
    depth: Int
): Boolean {
    val index = nextToken.toInt()
    if (index < 0) {
        return false
    }
    if (maxItems != null && maxItems <= index) {
        return false
    }
    return if (allItemSchema != null && hasRemaining) {
        allItemSchema.allowsProperty(remaining!!, depth + 1)
    } else {
        if (hasRemaining) {
            if (index < itemSchemas.size) {
                return itemSchemas[index].allowsProperty(remaining!!, depth + 1)
            }
            if (schemaOfAdditionalItems != null) {
                return schemaOfAdditionalItems.allowsProperty(remaining!!, depth + 1)
            }
        }
        getPrivateField("additionalItems")
    }
}

/** Copied from CombinedSchema.definesProperty(.) but returns true when the schema allows additionalProperties */
private fun CombinedSchema.allowsProperty(field: String, depth: Int): Boolean {
    val matching: MutableList<Schema> = ArrayList()
    for (subschema in subschemas) {
        if (subschema.allowsProperty(field, depth + 1)) {
            matching.add(subschema)
        }
    }
    try {
        criterion.validate(subschemas.size, matching.size)
    } catch (e: ValidationException) {
        return false
    }
    return true
}

/** Copied from ReferenceSchema.definesProperty(.) but returns true when the schema allows additionalProperties */
private fun ReferenceSchema.allowsProperty(field: String, depth: Int): Boolean {
    checkNotNull(referredSchema) { "referredSchema must be injected before validation" }
    return referredSchema.allowsProperty(field, depth + 1)
}

private fun Schema.headAndTailOfJsonPointerFragment(field: String): Array<String?> {
    val method = Schema::class.java.declaredMethods.single { it.name == "headAndTailOfJsonPointerFragment" }
    method.isAccessible = true
    return method.invoke(this, field) as Array<String?>
}

private fun <T> Any.getPrivateField(fieldName: String): T {
    val field = javaClass.getDeclaredField(fieldName)
    field.isAccessible = true
    return field.get(this) as T
}

private fun jsonPointerUnescape(token: String): String {
    val method = JSONPointer::class.java.declaredMethods.single { it.name == "unescape" }
    method.isAccessible = true
    return method.invoke(null, token) as String
}

private val logger = KotlinLogging.logger {}
