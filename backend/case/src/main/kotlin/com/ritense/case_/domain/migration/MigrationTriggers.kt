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
import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonDeserializer
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.SerializerProvider
import com.fasterxml.jackson.databind.annotation.JsonDeserialize
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/** When a plan may run: manually ([triggeredByButton]), at an instant ([scheduledAtDate]), or after another plan ([runAfter]). */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class MigrationTriggers(
    val triggeredByButton: Boolean = false,

    /** An instant, not a wall clock: a `LocalDateTime` went out labelled UTC by the ambient mapper and was compared against the server's zone. */
    @JsonSerialize(using = ScheduledAtDateSerializer::class)
    @JsonDeserialize(using = ScheduledAtDateDeserializer::class)
    val scheduledAtDate: Instant? = null,

    val runAfter: String? = null,
)

/** ISO-8601 instant, truncated to seconds so an export is stable and readable. */
class ScheduledAtDateSerializer : JsonSerializer<Instant>() {
    override fun serialize(value: Instant, gen: JsonGenerator, serializers: SerializerProvider) {
        gen.writeString(DateTimeFormatter.ISO_INSTANT.format(value.truncatedTo(ChronoUnit.SECONDS)))
    }
}

/** Offset-bearing, or naive as UTC — fixed, since `systemDefault()` changes on ApplicationReadyEvent. */
class ScheduledAtDateDeserializer : JsonDeserializer<Instant?>() {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): Instant? {
        if (p.currentToken?.isNumeric == true) return Instant.ofEpochMilli(p.longValue)
        val value = p.valueAsString?.trim()
        if (value.isNullOrEmpty()) return null
        val parsed = DateTimeFormatter.ISO_DATE_TIME.parseBest(value, OffsetDateTime::from, LocalDateTime::from)
        return when (parsed) {
            is OffsetDateTime -> parsed.toInstant()
            is LocalDateTime -> parsed.toInstant(ZoneOffset.UTC)
            else -> throw ctxt.weirdStringException(value, Instant::class.java, "Not an ISO-8601 date-time")
        }
    }
}
