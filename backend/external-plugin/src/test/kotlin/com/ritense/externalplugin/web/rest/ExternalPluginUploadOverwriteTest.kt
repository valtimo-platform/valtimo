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
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile
import org.springframework.web.client.HttpClientErrorException
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Verifies the upload endpoint's duplicate-version flow: a host `PLUGIN_VERSION_EXISTS` 409 is
 * enriched with the uploaded manifest's requested permissions (for the UI's re-review screen),
 * and a confirmed `overwrite=true` upload applies the approved overwrite — pin + re-grant — via
 * [ExternalPluginConfigurationService.applyApprovedOverwrite].
 */
class ExternalPluginUploadOverwriteTest {

    private lateinit var hostService: ExternalPluginHostService
    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var discoveryService: ExternalPluginDiscoveryService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var resource: ExternalPluginManagementResource

    private val hostId = UUID.randomUUID()

    private val manifestJson = """
        {
          "pluginId": "case-summary",
          "version": "0.1.0",
          "eventSubscriptions": ["com.ritense.valtimo.document.created"],
          "permissions": {
            "endpoints": [{"method": "GET", "pattern": "/api/v1/document/*"}],
            "capabilities": ["gzac_api", "log"]
          }
        }
    """.trimIndent()

    @BeforeEach
    fun setUp() {
        hostService = mock()
        configurationService = mock()
        discoveryService = mock()
        objectMapper = ObjectMapper()
        resource = ExternalPluginManagementResource(
            hostService,
            mock<ExternalPluginDefinitionService>(),
            configurationService,
            mock(),
            mock<EndpointDescriptionService>(),
            discoveryService,
            mock<Environment>(),
            GzacCompatibilityChecker(GzacVersionProvider { "13.1.3" }),
            PluginPackageInspector(objectMapper),
            objectMapper,
        )
    }

    @Test
    fun `enriches a host version-exists 409 with hashes and the requested permissions`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), any())).thenThrow(
            versionExistsException(currentContentHash = "sha256:current", uploadedContentHash = "sha256:uploaded")
        )

        val response = resource.uploadPlugin(hostId, pluginZip(manifestJson), force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CONFLICT)
        val body = response.body!!
        assertThat(body.get("code").asText()).isEqualTo("PLUGIN_VERSION_EXISTS")
        assertThat(body.get("pluginId").asText()).isEqualTo("case-summary")
        assertThat(body.get("version").asText()).isEqualTo("0.1.0")
        assertThat(body.get("currentContentHash").asText()).isEqualTo("sha256:current")
        assertThat(body.get("uploadedContentHash").asText()).isEqualTo("sha256:uploaded")
        assertThat(body.get("requestedEndpoints").single().get("pattern").asText())
            .isEqualTo("/api/v1/document/*")
        assertThat(body.get("requestedEventSubscriptions").map { it.asText() })
            .containsExactly("com.ritense.valtimo.document.created")
        assertThat(body.get("requestedCapabilities").map { it.asText() })
            .containsExactly("gzac_api", "log")
        verify(discoveryService, never()).discoverAll()
        verify(configurationService, never()).applyApprovedOverwrite(any(), any(), anyOrNull(), anyOrNull())
    }

    @Test
    fun `a confirmed overwrite pins the new content and re-grants before discovery runs`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), eq(true))).thenReturn(
            objectMapper.readTree(
                """{"pluginId": "case-summary", "version": "0.1.0", "contentHash": "sha256:new"}"""
            ) as JsonNode
        )

        val response = resource.uploadPlugin(hostId, pluginZip(manifestJson), force = true, overwrite = true)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        val manifestCaptor = argumentCaptor<JsonNode>()
        verify(configurationService).applyApprovedOverwrite(
            eq("case-summary"),
            eq("0.1.0"),
            eq("sha256:new"),
            manifestCaptor.capture(),
        )
        assertThat(manifestCaptor.firstValue.get("pluginId").asText()).isEqualTo("case-summary")
        verify(discoveryService).discoverAll()
    }

    @Test
    fun `a plain upload does not apply any overwrite approval`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), eq(false))).thenReturn(
            objectMapper.readTree("""{"pluginId": "case-summary", "version": "0.2.0"}""") as JsonNode
        )

        val response = resource.uploadPlugin(hostId, pluginZip(manifestJson), force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(configurationService, never()).applyApprovedOverwrite(any(), any(), anyOrNull(), anyOrNull())
    }

    @Test
    fun `a non-version-exists host 409 stays a relayed error body`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), any())).thenThrow(
            HttpClientErrorException.create(
                HttpStatus.CONFLICT,
                "Conflict",
                HttpHeaders.EMPTY,
                """{"error": "something else"}""".toByteArray(),
                null,
            )
        )

        val response = resource.uploadPlugin(hostId, pluginZip(manifestJson), force = false)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat(response.body!!.get("error").asText()).isEqualTo("Plugin host rejected the upload")
        assertThat(response.body!!.has("code")).isFalse()
    }

    private fun versionExistsException(
        currentContentHash: String,
        uploadedContentHash: String,
    ): HttpClientErrorException = HttpClientErrorException.create(
        HttpStatus.CONFLICT,
        "Conflict",
        HttpHeaders.EMPTY,
        """
            {
              "code": "PLUGIN_VERSION_EXISTS",
              "error": "Plugin version already exists: case-summary@0.1.0",
              "message": "This version already exists on the host.",
              "currentContentHash": "$currentContentHash",
              "uploadedContentHash": "$uploadedContentHash"
            }
        """.trimIndent().toByteArray(),
        null,
    )

    private fun pluginZip(manifest: String): MockMultipartFile {
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zos ->
            zos.putNextEntry(ZipEntry("manifest.json"))
            zos.write(manifest.toByteArray())
            zos.closeEntry()
        }
        return MockMultipartFile("file", "plugin.zip", "application/zip", out.toByteArray())
    }
}
