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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset

/** `scheduledAtDate` on the wire, on two mappers: the JSON column uses hypersistence's, not Spring's. */
class MigrationTriggersJsonTest {

    private val springMapper: ObjectMapper = MapperSingleton.get()
    private val bareMapper: ObjectMapper = ObjectMapper().registerKotlinModule()

    private fun mappers() = listOf("spring" to springMapper, "bare" to bareMapper)

    @Test
    fun `an instant is written as a true instant, not as a local time wearing a Z`() {
        val triggers = MigrationTriggers(scheduledAtDate = Instant.parse("2026-01-01T02:00:00Z"))

        mappers().forEach { (name, mapper) ->
            assertThat(mapper.writeValueAsString(triggers))
                .`as`("written by the $name mapper")
                .contains("\"scheduledAtDate\":\"2026-01-01T02:00:00Z\"")
        }
    }

    @Test
    fun `an offset-bearing value is read as the instant it names`() {
        // The same moment written two ways; both must survive the trip unchanged.
        listOf("2026-01-01T03:00:00+02:00", "2026-01-01T01:00:00Z").forEach { value ->
            mappers().forEach { (name, mapper) ->
                val triggers = mapper.readValue(json(value), MigrationTriggers::class.java)
                assertThat(triggers.scheduledAtDate)
                    .`as`("$value read by the $name mapper")
                    .isEqualTo(Instant.parse("2026-01-01T01:00:00Z"))
            }
        }
    }

    @Test
    fun `a naive value is read as UTC, so hand-written plan files keep working`() {
        // Fixed UTC, not systemDefault(), which changes on ApplicationReadyEvent -- after auto-deploy.
        val expected = LocalDateTime.parse("2026-01-01T03:00:00").toInstant(ZoneOffset.UTC)

        listOf("2026-01-01T03:00:00", "2026-01-01T03:00").forEach { value ->
            mappers().forEach { (name, mapper) ->
                assertThat(mapper.readValue(json(value), MigrationTriggers::class.java).scheduledAtDate)
                    .`as`("$value read by the $name mapper")
                    .isEqualTo(expected)
            }
        }
    }

    @Test
    fun `a round trip is lossless to the second`() {
        val triggers = MigrationTriggers(
            triggeredByButton = true,
            scheduledAtDate = Instant.parse("2026-07-01T14:13:00Z"),
            runAfter = "predecessor",
        )

        mappers().forEach { (name, mapper) ->
            val back = mapper.readValue(mapper.writeValueAsString(triggers), MigrationTriggers::class.java)
            assertThat(back).`as`("round-tripped by the $name mapper").isEqualTo(triggers)
        }
    }

    @Test
    fun `minutes survive, because the sweep now honours them`() {
        val triggers = MigrationTriggers(scheduledAtDate = Instant.parse("2026-07-01T14:13:00Z"))

        assertThat(springMapper.writeValueAsString(triggers)).contains("14:13:00Z")
    }

    @Test
    fun `no scheduled date is omitted rather than written as null`() {
        mappers().forEach { (name, mapper) ->
            assertThat(mapper.writeValueAsString(MigrationTriggers(triggeredByButton = true)))
                .`as`("written by the $name mapper")
                .doesNotContain("scheduledAtDate")
        }
    }

    private fun json(scheduledAtDate: String) =
        """{"triggeredByButton":false,"scheduledAtDate":"$scheduledAtDate"}"""
}
