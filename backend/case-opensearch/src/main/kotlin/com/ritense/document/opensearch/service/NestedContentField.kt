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

package com.ritense.document.opensearch.service

import com.ritense.authorization.permission.condition.PermissionConditionOperator
import org.opensearch.index.query.QueryBuilder
import org.opensearch.index.query.QueryBuilders
import org.opensearch.script.Script
import org.opensearch.script.ScriptType
import org.opensearch.search.sort.ScriptSortBuilder.ScriptSortType
import org.opensearch.search.sort.SortBuilder
import org.opensearch.search.sort.SortBuilders
import org.opensearch.search.sort.SortOrder
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.temporal.TemporalAccessor
import java.util.Date

/**
 * Queries on a `content` leaf inside an object, e.g. `content.lening.bedrag`. The object is a `flat_object`, so
 * the leaf has no `.keyword` sub-field and no numeric or date type, and OpenSearch 2.19 only supports `exists` and
 * sorting one level below the object. Typed comparisons, presence checks and deep sorts therefore run as scripts
 * over the object's doc values, which keeps them equal to PostgreSQL instead of comparing strings.
 */
object NestedContentField {

    fun isNested(field: String): Boolean =
        field.startsWith(CONTENT_PREFIX) && field.removePrefix(CONTENT_PREFIX).contains('.')

    fun applyOperator(field: String, op: PermissionConditionOperator, value: Any?): QueryBuilder =
        when (op) {
            PermissionConditionOperator.EQUAL_TO -> when (value) {
                null -> QueryBuilders.boolQuery().mustNot(present(field))
                is Number -> numberIn(field, listOf(value))
                else -> QueryBuilders.termQuery(field, value)
            }
            PermissionConditionOperator.NOT_EQUAL_TO -> when (value) {
                null -> present(field)
                is Number -> QueryBuilders.boolQuery().mustNot(numberIn(field, listOf(value)))
                else -> QueryBuilders.boolQuery().mustNot(QueryBuilders.termQuery(field, value))
            }
            PermissionConditionOperator.GREATER_THAN -> range(field, from = value, includeFrom = false)
            PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO -> range(field, from = value, includeFrom = true)
            PermissionConditionOperator.LESS_THAN -> range(field, to = value, includeTo = false)
            PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO -> range(field, to = value, includeTo = true)
            PermissionConditionOperator.LIST_CONTAINS ->
                if (value is Number) numberIn(field, listOf(value)) else QueryBuilders.termQuery(field, value)
            PermissionConditionOperator.IN -> {
                val values = (value as? Collection<*>)?.toList()
                    ?: throw IllegalArgumentException("IN operator requires a Collection value")
                if (values.isNotEmpty() && values.all { it is Number }) {
                    numberIn(field, values.filterIsInstance<Number>())
                } else {
                    QueryBuilders.termsQuery(field, values)
                }
            }
        }

    fun present(field: String): QueryBuilder = scriptFilter(field, mapOf("present" to true))

    fun numberIn(field: String, values: Collection<Number>): QueryBuilder =
        scriptFilter(field, mapOf("date" to false, "in" to values.map { it.toDouble() }))

    /**
     * Numbers compare numerically and dates as instants; any other bound compares as a string, which is what a
     * keyword range already does.
     */
    fun range(
        field: String,
        from: Any? = null,
        includeFrom: Boolean = true,
        to: Any? = null,
        includeTo: Boolean = true,
    ): QueryBuilder {
        val bounds = listOfNotNull(from, to)
        return when {
            bounds.isNotEmpty() && bounds.all { it is Number } ->
                typedRange(field, date = false, from = (from as Number?)?.toDouble(), includeFrom, (to as Number?)?.toDouble(), includeTo)
            bounds.isNotEmpty() && bounds.all { isTemporal(it) } ->
                typedRange(field, date = true, from = from?.let(::epochMillis), includeFrom, to?.let(::epochMillis), includeTo)
            else -> QueryBuilders.rangeQuery(field).apply {
                from?.let { if (includeFrom) gte(it) else gt(it) }
                to?.let { if (includeTo) lte(it) else lt(it) }
            }
        }
    }

    /** Depth-one leaves sort natively; deeper leaves fail to sort natively in OpenSearch 2.19, so use a script. */
    fun sort(field: String, ascending: Boolean): SortBuilder<*> {
        val order = if (ascending) SortOrder.ASC else SortOrder.DESC
        if (field.removePrefix(CONTENT_PREFIX).count { it == '.' } == 1) {
            return SortBuilders.fieldSort(field)
                .order(order)
                .missing(if (ascending) "_last" else "_first")
                .unmappedType("keyword")
        }
        val missingLast = if (ascending) "\uFFFF" else ""
        return SortBuilders.scriptSort(
            Script(ScriptType.INLINE, PAINLESS, SORT_SCRIPT, mapOf("path" to field, "missing" to missingLast)),
            ScriptSortType.STRING,
        ).order(order)
    }

    private fun typedRange(
        field: String,
        date: Boolean,
        from: Double?,
        includeFrom: Boolean,
        to: Double?,
        includeTo: Boolean,
    ): QueryBuilder = scriptFilter(
        field,
        mapOf("date" to date, "from" to from, "includeFrom" to includeFrom, "to" to to, "includeTo" to includeTo),
    )

    // The root `exists` narrows the script to documents that hold the object at all.
    private fun scriptFilter(field: String, params: Map<String, Any?>): QueryBuilder =
        QueryBuilders.boolQuery()
            .filter(QueryBuilders.existsQuery(rootOf(field)))
            .filter(QueryBuilders.scriptQuery(Script(ScriptType.INLINE, PAINLESS, FILTER_SCRIPT, DEFAULT_PARAMS + params + ("path" to field))))

    private fun rootOf(field: String): String =
        CONTENT_PREFIX + field.removePrefix(CONTENT_PREFIX).substringBefore('.')

    private fun isTemporal(value: Any): Boolean = value is TemporalAccessor || value is Date

    private fun epochMillis(value: Any): Double = when (value) {
        is Instant -> value.toEpochMilli()
        is OffsetDateTime -> value.toInstant().toEpochMilli()
        is ZonedDateTime -> value.toInstant().toEpochMilli()
        is LocalDateTime -> value.toInstant(ZoneOffset.UTC).toEpochMilli()
        is LocalDate -> value.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        is Date -> value.time
        is TemporalAccessor -> Instant.from(value).toEpochMilli()
        else -> throw IllegalArgumentException("Not a date: $value")
    }.toDouble()

    private const val CONTENT_PREFIX = "content."
    private const val PAINLESS = "painless"

    private val DEFAULT_PARAMS: Map<String, Any?> =
        mapOf("present" to false, "date" to false, "in" to null, "from" to null, "includeFrom" to true, "to" to null, "includeTo" to true)

    // A flat_object's doc values hold every leaf of the object as "<...>content.a.b=value"; match the exact path.
    private const val FILTER_SCRIPT = """
double parse(String raw, boolean date) {
  try {
    if (!date) { return Double.parseDouble(raw); }
    if (raw.length() == 10) { return LocalDate.parse(raw).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(); }
    if (raw.endsWith('Z') || raw.indexOf('+', 10) > 0 || raw.indexOf('-', 10) > 0) { return OffsetDateTime.parse(raw).toInstant().toEpochMilli(); }
    return LocalDateTime.parse(raw).toInstant(ZoneOffset.UTC).toEpochMilli();
  } catch (Exception e) {
    return Double.NaN;
  }
}
boolean matches(double x, def p) {
  if (p.in != null) {
    for (def candidate : p.in) { if (x == candidate) { return true; } }
    return false;
  }
  if (p.from != null && (p.includeFrom ? x < p.from : x <= p.from)) { return false; }
  if (p.to != null && (p.includeTo ? x > p.to : x >= p.to)) { return false; }
  return true;
}
String marker = params.path + '=';
if (!doc.containsKey(params.path)) { return false; }
for (def entry : doc[params.path]) {
  int at = entry.lastIndexOf(marker);
  if (at >= 0 && (at == 0 || entry.charAt(at - 1) == (char) '.')) {
    if (params.present) { return true; }
    double x = parse(entry.substring(at + marker.length()), params.date);
    if (!Double.isNaN(x) && matches(x, params)) { return true; }
  }
}
return false;
"""

    private const val SORT_SCRIPT = """
String marker = params.path + '=';
if (doc.containsKey(params.path)) {
  for (def entry : doc[params.path]) {
    int at = entry.lastIndexOf(marker);
    if (at >= 0 && (at == 0 || entry.charAt(at - 1) == (char) '.')) { return entry.substring(at + marker.length()); }
  }
}
return params.missing;
"""
}
