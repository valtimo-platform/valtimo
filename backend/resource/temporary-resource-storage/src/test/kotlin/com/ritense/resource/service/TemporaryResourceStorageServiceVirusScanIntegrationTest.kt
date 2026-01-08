/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.resource.service

import com.ritense.resource.BaseIntegrationTest
import com.ritense.resource.domain.VirusScanResult
import com.ritense.resource.domain.VirusScanStatus
import com.ritense.valtimo.contract.upload.VirusDetectedException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.`when`
import org.mockito.kotlin.any
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean

@TestPropertySource(properties = [
    "valtimo.virusscan.clamav.TemporaryResourceStorageService.enabled=true"
])
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TemporaryResourceStorageServiceVirusScanIntegrationTest : BaseIntegrationTest() {


    @Autowired
    lateinit var temporaryResourceStorageService: TemporaryResourceStorageService

    @MockitoBean
    lateinit var virusScanService: VirusScanService

    @Test
    fun `stores file when virus scan is clean`() {
        val noVirus = VirusScanResult(
            status = VirusScanStatus.OK,
            foundViruses = mapOf()
        )
        // Arrange: external API says no virus
        `when`(virusScanService.scan(any())).thenReturn(noVirus)

        // Act
        val id = temporaryResourceStorageService.store("ok".byteInputStream())

        // Assert
        assertThat(id).isNotBlank()
    }

    @Test
    fun `virus found at temp file store`() {
        val exception = assertThrows<VirusDetectedException> {
            val virusFound = VirusScanResult(
                status = VirusScanStatus.VIRUS_FOUND,
                foundViruses = mapOf(
                    "/tmp/upload/image.png" to listOf("Dummy.Worm.XYZ")
                )
            )
            // Arrange: external API says virus
            `when`(virusScanService.scan(any())).thenReturn(virusFound)

            // Act
            temporaryResourceStorageService.store("ok".byteInputStream())
        }
        // Assert
        assertThat(exception.message).contains("virus detected")
    }
}
