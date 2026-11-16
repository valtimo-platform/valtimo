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
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
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

    private fun serviceWith(properties: ExchangeProperties) = ExchangeInstallService(properties, client)

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
    fun `should not find a publication that is not published`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(status = "DRAFT"))

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should not find a missing publication`() {
        whenever(client.getPublication(publicationId)).thenReturn(null)

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should not find an artifact that belongs to another publication`() {
        whenever(client.getPublication(publicationId)).thenReturn(publication(id = UUID.randomUUID()))

        assertThrows<ExchangeArtifactNotFoundException> { service.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should refuse plugin and unknown manifest types`() {
        listOf("PLUGIN", "SOMETHING_ELSE", null).forEach { type ->
            whenever(client.getPublication(publicationId)).thenReturn(publication(manifestType = type))

            assertThrows<ExchangeArtifactNotInstallableException> { service.getArtifactContent(publicationId, artifactId) }
        }
    }

    @Test
    fun `should default to the public GZAC Exchange`() {
        val properties = ExchangeProperties()

        assertEquals("https://exchange.gzac.nl", properties.baseUrl)
        assertEquals(true, properties.enabled)
    }

    @Test
    fun `should be disabled without a url`() {
        val disabled = serviceWith(ExchangeProperties(url = " "))

        assertThrows<ExchangeDisabledException> { disabled.getArtifactContent(publicationId, artifactId) }
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
    fun `should keep the asset path with a trailing slash and drop invalid entries`() {
        val properties = ExchangeProperties(
            url = "https://exchange.example.org",
            assetOrigins = listOf(
                "https://Assets.Example.org/bucket/key?signature=x#top",
                "https://assets.example.org/bucket/key/",
                "http://localhost:9000",
                "https://assets.example.org/bucket;evil",
                "ftp://assets.example.org",
                "not a url",
                " ",
            ),
        )

        assertEquals(
            listOf("https://assets.example.org/bucket/key/", "http://localhost:9000/"),
            serviceWith(properties).getConfiguration().assetOrigins,
        )
    }

    @Test
    fun `should default to the public exchange asset origin`() {
        assertEquals(
            listOf("https://s3.de.io.cloud.ovh.net/ritense-external-extra-prod-exchange/"),
            serviceWith(ExchangeProperties()).getConfiguration().assetOrigins,
        )
    }

    @Test
    fun `should report no asset origins when disabled`() {
        assertEquals(emptyList<String>(), serviceWith(ExchangeProperties(url = "")).getConfiguration().assetOrigins)
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
}
