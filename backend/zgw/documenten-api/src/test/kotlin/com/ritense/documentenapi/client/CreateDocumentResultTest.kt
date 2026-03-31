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

package com.ritense.documentenapi.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.fasterxml.jackson.module.kotlin.readValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.OffsetDateTime
import java.time.ZoneOffset

internal class CreateDocumentResultTest {

    private val objectMapper = ObjectMapper()
        .registerModule(KotlinModule.Builder().build())
        .registerModule(JavaTimeModule())

    @Test
    fun `should deserialize beginRegistratie with offset`() {
        val json = """
            {
                "url": "https://www.example.com/847789d3-a8b3-469a-ae01-a49a6bd21783",
                "auteur": "test",
                "bestandsnaam": "test.txt",
                "bestandsomvang": 123,
                "beginRegistratie": "2026-03-23T14:37:41+01:00",
                "bestandsdelen": [],
                "lock": null
            }
        """.trimIndent()

        val result = objectMapper.readValue<CreateDocumentResult>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.ofHours(1)), result.beginRegistratie)
    }

    @Test
    fun `should deserialize beginRegistratie without offset`() {
        val json = """
            {
                "url": "https://www.example.com/847789d3-a8b3-469a-ae01-a49a6bd21783",
                "auteur": "test",
                "bestandsnaam": "test.txt",
                "bestandsomvang": 123,
                "beginRegistratie": "2026-03-23T14:37:41",
                "bestandsdelen": [],
                "lock": null
            }
        """.trimIndent()

        val result = objectMapper.readValue<CreateDocumentResult>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.UTC), result.beginRegistratie)
    }

    @Test
    fun `should deserialize beginRegistratie with zoned datetime`() {
        val json = """
            {
                "url": "https://www.example.com/847789d3-a8b3-469a-ae01-a49a6bd21783",
                "auteur": "test",
                "bestandsnaam": "test.txt",
                "bestandsomvang": 123,
                "beginRegistratie": "2026-03-23T14:37:41+01:00[Europe/Amsterdam]",
                "bestandsdelen": [],
                "lock": null
            }
        """.trimIndent()

        val result = objectMapper.readValue<CreateDocumentResult>(json)

        assertEquals(OffsetDateTime.of(2026, 3, 23, 14, 37, 41, 0, ZoneOffset.ofHours(1)), result.beginRegistratie)
    }

    @Test
    fun `should get uuid from url`() {
        val result = CreateDocumentResult(
            "https://www.example.com/847789d3-a8b3-469a-ae01-a49a6bd21783",
            "",
            "",
            0L,
            OffsetDateTime.now(),
            listOf(),
            null
        )

        assertEquals("847789d3-a8b3-469a-ae01-a49a6bd21783", result.getDocumentUUIDFromUrl())
    }

    @Test
    fun `should get lock from bestanddelen`() {
        val bestandsdeel = Bestandsdeel(
            "https://www.example.com/",
            0,
            0,
            true,
            "a894d4fc-593a-444f-821e-e2af32259e45"
        )
        val result = CreateDocumentResult(
            "",
            "",
            "",
            0L,
            OffsetDateTime.now(),
            listOf(bestandsdeel),
            "847789d3-a8b3-469a-ae01-a49a6bd21783"
        )

        assertEquals("847789d3-a8b3-469a-ae01-a49a6bd21783", result.getLockOrEmpty())
    }

    @Test
    fun `should fail gracefully for lock when there are no bestandsdelen`() {
        val result = CreateDocumentResult(
            "",
            "",
            "",
            0L,
            OffsetDateTime.now(),
            listOf(),
            null
        )

        assertEquals("", result.getLockOrEmpty())
    }

}