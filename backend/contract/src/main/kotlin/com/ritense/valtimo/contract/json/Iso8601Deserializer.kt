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

package com.ritense.valtimo.contract.json

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.deser.std.StdDeserializer
import java.io.IOException
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeParseException

class Iso8601Deserializer : StdDeserializer<OffsetDateTime?>(OffsetDateTime::class.java) {

    @Throws(IOException::class)
    override fun deserialize(p: JsonParser, ctx: DeserializationContext?): OffsetDateTime? {
        val value = p.text?.trim()

        if (value.isNullOrBlank()) {
            return null
        }

        return parseOrNull(value) ?: error("Failed to parse ISO 8601 datetime: '$value'")
    }

    companion object {
        /**
         * Parses an ISO-8601 timestamp tolerantly, accepting:
         * - Offset date-time (`2026-03-23T14:37:41+01:00`, `2026-03-23T14:37:41Z`)
         * - Zoned date-time (`2026-03-23T14:37:41+01:00[Europe/Amsterdam]`)
         * - Instant (`2026-03-23T14:37:41Z`) — interpreted at UTC
         * - Local date-time (`2026-03-23T14:37:41`) — interpreted at UTC
         *
         * Returns null when the value is not a parseable timestamp.
         */
        fun parseOrNull(value: String): OffsetDateTime? {
            try {
                return OffsetDateTime.parse(value)
            } catch (ignored: DateTimeParseException) {
            }

            try {
                return ZonedDateTime.parse(value).toOffsetDateTime()
            } catch (ignored: DateTimeParseException) {
            }

            try {
                return Instant.parse(value).atOffset(ZoneOffset.UTC)
            } catch (ignored: DateTimeParseException) {
            }

            try {
                return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC)
            } catch (ignored: DateTimeParseException) {
            }

            return null
        }
    }
}