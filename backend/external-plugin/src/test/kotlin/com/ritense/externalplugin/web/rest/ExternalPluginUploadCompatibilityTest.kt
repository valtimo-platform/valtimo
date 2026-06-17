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

package com.ritense.externalplugin.web.rest

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.GzacVersionProvider
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Verifies the upload endpoint's compatibility gate: an incompatible package is rejected with a
 * 409 (and never reaches the host) unless the operator forces it, while compatible packages and
 * packages without a compatibility declaration upload straight through.
 */
class ExternalPluginUploadCompatibilityTest {

    private lateinit var hostService: ExternalPluginHostService
    private lateinit var discoveryService: ExternalPluginDiscoveryService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var resource: ExternalPluginManagementResource

    private val hostId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        hostService = mock()
        discoveryService = mock()
        objectMapper = ObjectMapper()
        whenever(hostService.uploadPlugin(any(), any(), any()))
            .thenReturn(objectMapper.createObjectNode().put("pluginId", "x") as JsonNode)

        resource = ExternalPluginManagementResource(
            hostService,
            mock<ExternalPluginDefinitionService>(),
            mock<ExternalPluginConfigurationService>(),
            mock<EndpointDescriptionService>(),
            discoveryService,
            mock<Environment>(),
            GzacCompatibilityChecker(GzacVersionProvider { "13.1.3" }),
            PluginPackageInspector(objectMapper),
            objectMapper,
        )
    }

    @Test
    fun `rejects a plugin that needs a newer GZAC with 409 and does not upload to the host`() {
        val file = pluginZip("""{"compatibility":{"minGzacVersion":"14.0.0"}}""")

        val response = resource.uploadPlugin(hostId, file, force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat(response.body!!.get("incompatible").asBoolean()).isTrue()
        assertThat(response.body!!.get("currentGzacVersion").asText()).isEqualTo("13.1.3")
        assertThat(response.body!!.get("minGzacVersion").asText()).isEqualTo("14.0.0")
        verify(hostService, never()).uploadPlugin(any(), any(), any())
        verify(discoveryService, never()).discoverAll()
    }

    @Test
    fun `rejects a plugin whose maximum is below the running GZAC`() {
        val file = pluginZip("""{"compatibility":{"minGzacVersion":"12.0.0","maxGzacVersion":"12.1.0"}}""")

        val response = resource.uploadPlugin(hostId, file, force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat(response.body!!.get("incompatible").asBoolean()).isTrue()
        assertThat(response.body!!.get("maxGzacVersion").asText()).isEqualTo("12.1.0")
        verify(hostService, never()).uploadPlugin(any(), any(), any())
    }

    @Test
    fun `uploads an incompatible plugin when forced`() {
        val file = pluginZip("""{"compatibility":{"minGzacVersion":"14.0.0"}}""")

        val response = resource.uploadPlugin(hostId, file, force = true)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(hostService).uploadPlugin(any(), any(), any())
        verify(discoveryService).discoverAll()
    }

    @Test
    fun `uploads a compatible plugin straight through`() {
        val file = pluginZip("""{"compatibility":{"minGzacVersion":"12.0.0"}}""")

        val response = resource.uploadPlugin(hostId, file, force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(hostService).uploadPlugin(any(), any(), any())
    }

    @Test
    fun `uploads a plugin without a compatibility declaration`() {
        val file = pluginZip("""{"pluginId":"x","version":"1.0.0"}""")

        val response = resource.uploadPlugin(hostId, file, force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(hostService).uploadPlugin(any(), any(), any())
    }

    private fun pluginZip(manifestJson: String): MockMultipartFile {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zos ->
            zos.putNextEntry(ZipEntry("manifest.json"))
            zos.write(manifestJson.toByteArray())
            zos.closeEntry()
        }
        return MockMultipartFile("file", "plugin.zip", "application/zip", out.toByteArray())
    }
}
