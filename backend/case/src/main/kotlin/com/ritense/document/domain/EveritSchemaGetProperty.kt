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

import com.fasterxml.jackson.core.type.TypeReference
import io.github.oshai.kotlinlogging.KotlinLogging
import org.everit.json.schema.ArraySchema
import org.everit.json.schema.BooleanSchema
import org.everit.json.schema.CombinedSchema
import org.everit.json.schema.ConditionalSchema
import org.everit.json.schema.ConstSchema
import org.everit.json.schema.EmptySchema
import org.everit.json.schema.EnumSchema
import org.everit.json.schema.FalseSchema
import org.everit.json.schema.JSONPointer
import org.everit.json.schema.NotSchema
import org.everit.json.schema.NullSchema
import org.everit.json.schema.NumberSchema
import org.everit.json.schema.ObjectSchema
import org.everit.json.schema.ReferenceSchema
import org.everit.json.schema.Schema
import org.everit.json.schema.StringSchema
import org.everit.json.schema.TrueSchema
import org.everit.json.schema.regexp.Regexp

/** This method is similar to org.everit.json.schema.Schema.definesProperty(.)  */
fun Schema.getProperty(field: String): Schema? = getProperty(field, 0)

/**
 * @param depth how many schema levels have been descended into already, guarded by [MAX_SCHEMA_DEPTH] so a
 * recursive schema does not cause a `StackOverflowError`.
 */
private fun Schema.getProperty(field: String, depth: Int): Schema? {
    if (depth > MAX_SCHEMA_DEPTH) {
        logger.warn { "Stopped looking for property '$field'. The schema is nested deeper than $MAX_SCHEMA_DEPTH levels." }
        return null
    }
    return when (this) {
        is ObjectSchema -> getProperty(field, depth)
        is ArraySchema -> getProperty(field, depth)
        is CombinedSchema -> getProperty(field, depth)
        is ReferenceSchema -> getProperty(field, depth)
        else -> null
    }
}

private fun ObjectSchema.getProperty(field: String, depth: Int): Schema? {
    val headAndTail: Array<String?> = headAndTailOfJsonPointerFragment(field)
    val nextToken = headAndTail[0]!!
    val remaining = headAndTail[1]
    val field2 = headAndTail[2]!!
    return if (field2.isEmpty()) {
        null
    } else {
        getSchemaProperty(nextToken, remaining, depth)
            ?: getPatternProperty(nextToken, remaining, depth)
            ?: getSchemaDependencyProperty(field2, depth)
    }
}

private fun ObjectSchema.getSchemaProperty(current: String, remaining: String?, depth: Int): Schema? {
    val currentUnescaped = jsonPointerUnescape(current)
    return if (propertySchemas.containsKey(currentUnescaped)) {
        if (remaining != null) {
            propertySchemas[currentUnescaped]!!.getProperty(remaining, depth + 1)
        } else {
            propertySchemas[currentUnescaped]!!
        }
    } else null
}

private fun ObjectSchema.getPatternProperty(current: String, remaining: String?, depth: Int): Schema? {
    val patternProperties = getPrivateField<Map<Regexp, Schema>>("patternProperties")
    patternProperties.entries.forEach { (pattern, value) ->
        if (!pattern.patternMatchingFailure(current).isPresent) {
            return if (remaining == null) {
                value
            } else {
                value.getProperty(remaining, depth + 1)
            }
        }
    }
    return null
}

private fun ObjectSchema.getSchemaDependencyProperty(field: String, depth: Int): Schema? {
    for (schema in schemaDependencies.values) {
        val property = schema.getProperty(field, depth + 1)
        if (property != null) {
            return property
        }
    }
    return null
}

private fun ArraySchema.getProperty(field: String, depth: Int): Schema? {
    val headAndTail: Array<String?> = headAndTailOfJsonPointerFragment(field)
    val nextToken = headAndTail[0]!!
    val remaining = headAndTail[1]
    val hasRemaining = remaining != null
    return try {
        tryGetPropertyDefinitionByNumericIndex(nextToken, remaining, hasRemaining, depth)
    } catch (e: NumberFormatException) {
        tryGetPropertyDefinitionByMetaIndex(nextToken, remaining, hasRemaining, depth)
    }
}


private fun ArraySchema.tryGetPropertyDefinitionByMetaIndex(
    nextToken: String,
    remaining: String?,
    hasRemaining: Boolean,
    depth: Int
): Schema? {
    val isAll = "all" == nextToken
    val isAny = "any" == nextToken
    if (!hasRemaining && (isAll || isAny)) {
        return this
    }
    if (isAll) {
        return if (allItemSchema != null) {
            allItemSchema.getProperty(remaining!!, depth + 1)
        } else {
            // the depth-guarded getProperty(.) is used instead of everit's definesProperty(.), which recurses unbounded
            val allItemSchemasDefine: Boolean = itemSchemas.stream()
                .map { schema -> schema.getProperty(remaining!!, depth + 1) != null }
                .reduce(true) { a, b -> java.lang.Boolean.logicalAnd(a, b) }
            if (allItemSchemasDefine) {
                return if (schemaOfAdditionalItems != null) {
                    schemaOfAdditionalItems.getProperty(remaining!!, depth + 1)
                } else {
                    this
                }
            }
            null
        }
    } else if (isAny) {
        return if (allItemSchema != null) {
            allItemSchema.getProperty(remaining!!, depth + 1)
        } else {
            val anyItemSchemasDefine: Boolean = itemSchemas.stream()
                .map { schema -> schema.getProperty(remaining!!, depth + 1) != null }
                .reduce(false) { a, b -> java.lang.Boolean.logicalOr(a, b) }
            if (anyItemSchemasDefine) {
                return if (schemaOfAdditionalItems != null) {
                    schemaOfAdditionalItems.getProperty(remaining!!, depth + 1)
                } else {
                    this
                }
            }
            null
        }
    }
    return null
}

private fun ArraySchema.tryGetPropertyDefinitionByNumericIndex(
    nextToken: String,
    remaining: String?,
    hasRemaining: Boolean,
    depth: Int
): Schema? {
    val index = nextToken.toInt()
    if (index < 0) {
        return null
    }
    if (maxItems != null && maxItems <= index) {
        return null
    }
    val itemSchema = allItemSchema
        ?: itemSchemas.getOrNull(index)
        ?: schemaOfAdditionalItems
        ?: return null
    return if (hasRemaining) itemSchema.getProperty(remaining!!, depth + 1) else itemSchema
}

private fun CombinedSchema.getProperty(field: String, depth: Int): Schema? {
    // the depth-guarded getProperty(.) is used instead of everit's definesProperty(.), which recurses unbounded
    val matches = subschemas.mapNotNull { it.getProperty(field, depth + 1) }.distinct()
    return when (matches.size) {
        0 -> null
        1 -> matches.single()
        else -> CombinedSchema.builder(matches.sortedBy { it.toString() })
            .criterion(criterion)
            .build()
    }
}

private fun ReferenceSchema.getProperty(field: String, depth: Int): Schema? {
    checkNotNull(referredSchema) { "referredSchema must be injected before validation" }
    return referredSchema.getProperty(field, depth + 1)
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

fun Schema.getTypeReference(): TypeReference<*> {
    return when (this) {
        is ArraySchema -> object : TypeReference<List<Any>>() {}
        is BooleanSchema -> object : TypeReference<Boolean>() {}
        is CombinedSchema -> object : TypeReference<Any>() {}
        is ConditionalSchema -> object : TypeReference<Any>() {}
        is ConstSchema -> object : TypeReference<Any>() {}
        is EnumSchema -> object : TypeReference<Any>() {}
        is FalseSchema -> object : TypeReference<Boolean>() {}
        is NotSchema -> object : TypeReference<Any>() {}
        is NullSchema -> object : TypeReference<Void>() {}
        is NumberSchema -> object : TypeReference<Number>() {}
        is ObjectSchema -> object : TypeReference<Map<String, Any>>() {}
        is ReferenceSchema -> object : TypeReference<Any>() {}
        is StringSchema -> object : TypeReference<String>() {}
        is TrueSchema -> object : TypeReference<Boolean>() {}
        is EmptySchema -> object : TypeReference<Void>() {}
        else -> object : TypeReference<Any>() {}
    }
}

private val logger = KotlinLogging.logger {}
