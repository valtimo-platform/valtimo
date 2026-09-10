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

package com.ritense.externalplugin.autodeployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.service.ExternalPluginHostService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.Resource
import org.springframework.core.io.ResourceLoader
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import java.nio.charset.StandardCharsets
import java.util.UUID

class ExternalPluginPackageDeployerTest {
    private val objectMapper = ObjectMapper()
    private val hostId = UUID.fromString("11111111-1111-1111-1111-111111111111")

    private lateinit var resourceLoader: ResourceLoader
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var deployer: ExternalPluginPackageDeployer

    @BeforeEach
    fun setUp() {
        resourceLoader = mock()
        hostService = mock()
        whenever(resourceLoader.getResource(any())).thenReturn(packageResource())
        deployer = ExternalPluginPackageDeployer(resourceLoader, hostService, objectMapper)
    }

    @Test
    fun `uploads a registered package when the host is reachable`() {
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip")))

        deployer.deployPending(host())

        verify(hostService).uploadPlugin(eq(hostId), eq("case-summary-0.1.0.zip"), any(), eq(false))
    }

    @Test
    fun `does nothing for a host with no registered packages`() {
        deployer.deployPending(host())

        verify(hostService, never()).uploadPlugin(any(), any(), any(), any())
    }

    @Test
    fun `uploads a package only once across repeated polls`() {
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip")))

        repeat(5) { deployer.deployPending(host()) }

        verify(hostService, times(1)).uploadPlugin(any(), any(), any(), any())
    }

    @Test
    fun `treats an identical package already on the host as settled`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), any()))
            .thenThrow(conflict(current = "sha256:same", uploaded = "sha256:same"))
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip")))

        deployer.deployPending(host())
        deployer.deployPending(host())

        verify(hostService, times(1)).uploadPlugin(any(), any(), any(), any())
    }

    @Test
    fun `does not replace a package whose content differs, and stops retrying it`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), any()))
            .thenThrow(conflict(current = "sha256:installed", uploaded = "sha256:descriptor"))
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip")))

        deployer.deployPending(host())
        deployer.deployPending(host())

        verify(hostService, times(1)).uploadPlugin(any(), any(), any(), eq(false))
    }

    @Test
    fun `retries on the next poll when the upload fails outright`() {
        whenever(hostService.uploadPlugin(any(), any(), any(), any()))
            .thenThrow(RuntimeException("connection reset"))
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip")))

        deployer.deployPending(host())
        deployer.deployPending(host())

        verify(hostService, times(2)).uploadPlugin(any(), any(), any(), any())
    }

    @Test
    fun `a package missing from the classpath is reported once and never retried`() {
        whenever(resourceLoader.getResource(any())).thenReturn(ClassPathResource("definitely-not-packaged.zip"))
        deployer.register(hostId, listOf(PackageDeploymentDto("classpath:missing.zip")))

        deployer.deployPending(host())
        deployer.deployPending(host())

        verify(hostService, never()).uploadPlugin(any(), any(), any(), any())
    }

    @Test
    fun `forwards the overwrite flag`() {
        deployer.register(
            hostId,
            listOf(PackageDeploymentDto("classpath:case-summary-0.1.0.zip", overwrite = true))
        )

        deployer.deployPending(host())

        verify(hostService).uploadPlugin(any(), any(), any(), eq(true))
    }

    private fun packageResource(): Resource =
        object : ByteArrayResource("zip-bytes".toByteArray()) {
            override fun getFilename(): String = "case-summary-0.1.0.zip"
        }

    private fun host() = ExternalPluginHost(
        id = hostId,
        name = "Local plugin host",
        baseUrl = "http://localhost:8090",
        secret = "encrypted",
        status = ExternalPluginHostStatus.CONNECTED,
        kind = ExternalPluginHostKind.PLUGIN_HOST,
    )

    private fun conflict(current: String, uploaded: String): HttpClientErrorException =
        HttpClientErrorException.create(
            HttpStatus.CONFLICT,
            "Conflict",
            HttpHeaders(),
            """{"code":"PLUGIN_VERSION_EXISTS","currentContentHash":"$current","uploadedContentHash":"$uploaded"}"""
                .toByteArray(),
            StandardCharsets.UTF_8,
        )
}
