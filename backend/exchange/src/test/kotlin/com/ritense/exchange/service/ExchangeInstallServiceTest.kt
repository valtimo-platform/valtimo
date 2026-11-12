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

package com.ritense.exchange.service

import com.ritense.exchange.client.ExchangeClient
import com.ritense.exchange.client.dto.ExchangeArtifact
import com.ritense.exchange.client.dto.ExchangeArtifactDependency
import com.ritense.exchange.client.dto.ExchangePublication
import com.ritense.exchange.config.ExchangeProperties
import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactNotInstallableException
import com.ritense.exchange.exception.ExchangeDisabledException
import com.ritense.exchange.web.rest.dto.ExchangeArtifactType
import com.ritense.exchange.web.rest.dto.ExchangeCompatibility
import com.ritense.exchange.web.rest.dto.ExchangeDependencyType
import com.ritense.exporter.manifest.ValtimoVersionResolver
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class ExchangeInstallServiceTest {
    private lateinit var client: ExchangeClient
    private lateinit var service: ExchangeInstallService

    private val publicationId = UUID.randomUUID()
    private val artifactId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        client = mock()
        service = serviceWith(ExchangeProperties(url = "https://exchange.example.org/"))
    }

    private fun serviceWith(properties: ExchangeProperties, runningVersion: String = "13.53.0") =
        ExchangeInstallService(properties, client, ValtimoVersionResolver { runningVersion })

    private fun publication(
        status: String = "PUBLISHED",
        manifestType: String? = "CASE_DEFINITION",
        id: UUID = artifactId,
        valtimoVersion: String? = "13",
    ) = ExchangePublication(
        id = publicationId.toString(),
        name = "Plan",
        status = status,
        publicationType = "CaseDefinition",
        artifacts = listOf(
            ExchangeArtifact(
                id = id.toString(),
                versionTag = "1.0.0",
                title = "Plan 1.0.0",
                manifestType = manifestType,
                valtimoVersion = valtimoVersion,
                fileName = "plan.zip",
                dependencies = listOf(
                    ExchangeArtifactDependency("BUILDING_BLOCK", "bb", "Block", "1.0.0"),
                    ExchangeArtifactDependency("PLUGIN", "p", "Plugin", null),
                    ExchangeArtifactDependency("OTHER", "x", "Other", null),
                ),
            )
        ),
    )

    @Test
    fun `should return artifact details with typed dependencies`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication())

        val dto = service.getArtifact(publicationId, artifactId)

        assertEquals(ExchangeArtifactType.CASE_DEFINITION, dto.type)
        assertEquals("Plan", dto.publicationName)
        assertEquals("13.53.0", dto.runningValtimoVersion)
        assertEquals(
            listOf(ExchangeDependencyType.BUILDING_BLOCK, ExchangeDependencyType.PLUGIN),
            dto.dependencies.map { it.type }
        )
    }

    @Test
    fun `should map a building block manifest type`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(manifestType = "BUILDING_BLOCK"))

        assertEquals(ExchangeArtifactType.BUILDING_BLOCK, service.getArtifact(publicationId, artifactId).type)
    }

    @Test
    fun `should not find a publication that is not published`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(status = "DRAFT"))

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifact(publicationId, artifactId) }
    }

    @Test
    fun `should not find a missing publication`() {
        whenever(client.getPublication(publicationId)).thenReturn(null)

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifact(publicationId, artifactId) }
    }

    @Test
    fun `should not find an artifact that belongs to another publication`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(id = UUID.randomUUID()))

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifact(publicationId, artifactId) }
    }

    @Test
    fun `should refuse plugin and unknown manifest types`() {
        listOf("PLUGIN", "SOMETHING_ELSE", null).forEach { type ->
            whenever(client.getPublication(publicationId)).thenReturn(publication(manifestType = type))

            assertThrows<ExchangeArtifactNotInstallableException> { service.getArtifact(publicationId, artifactId) }
        }
    }

    @Test
    fun `should be disabled without a url`() {
        val disabled = serviceWith(ExchangeProperties(url = " "))

        assertThrows<ExchangeDisabledException> { disabled.getArtifact(publicationId, artifactId) }
        verify(client, never()).getPublication(publicationId)
    }

    @Test
    fun `should be disabled for a non http url`() {
        val disabled = serviceWith(ExchangeProperties(url = "ftp://exchange.example.org"))

        assertEquals(false, disabled.getConfiguration().enabled)
    }

    @Test
    fun `should strip the trailing slash from the configured url`() {
        assertEquals("https://exchange.example.org", service.getConfiguration().url)
    }

    @Test
    fun `should revalidate before downloading`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(status = "PENDING_REVIEW"))

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifactContent(publicationId, artifactId) }
        verify(client, never()).getArtifactContent(publicationId, artifactId)
    }

    @Test
    fun `should download the content with the file name`() {
        val content = byteArrayOf(9, 8)
        whenever(client.getPublication(publicationId)).thenReturn(publication())
        whenever(client.getArtifactContent(publicationId, artifactId)).thenReturn(content)

        val (fileName, bytes) = service.getArtifactContent(publicationId, artifactId)

        assertEquals("plan.zip", fileName)
        assertArrayEquals(content, bytes)
    }

    @ParameterizedTest
    @CsvSource(
        "13, 13.53.0, COMPATIBLE",
        "13.53.0, 13.53.0, COMPATIBLE",
        "13.52.9, 13.53.0, COMPATIBLE",
        "12.99.99, 13.53.0, COMPATIBLE",
        "13.60.0, 13.53.0, NEWER",
        "14, 13.53.0, NEWER",
        "13.53.1, 13.53.0, NEWER",
        "13.53.0-SNAPSHOT, 13.53.0, COMPATIBLE",
        "13.54.0+build5, 13.53.0, NEWER",
        "'', 13.53.0, UNKNOWN",
        "13.53.0, '', UNKNOWN",
        "abc, 13.53.0, UNKNOWN",
        "13.x, 13.53.0, UNKNOWN",
    )
    fun `should compare versions`(artifact: String, running: String, expected: ExchangeCompatibility) {
        assertEquals(expected, ExchangeInstallService.compatibility(artifact, running))
    }

    @Test
    fun `should treat a missing artifact version as unknown`() {
        assertEquals(ExchangeCompatibility.UNKNOWN, ExchangeInstallService.compatibility(null, "13.53.0"))
    }
}
