/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_LINK
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class BuildingBlockProcessLinkImporterTest(
    @Mock private val processLinkService: ProcessLinkService,
    @Mock private val repositoryService: OperatonRepositoryService,
    @Mock private val objectMapper: ObjectMapper,
) {

    private lateinit var importer: BuildingBlockProcessLinkImporter

    @BeforeEach
    fun setUp() {
        `when`(processLinkService.getImporterDependsOnTypes())
            .thenReturn(setOf("some-other-type"))

        importer = BuildingBlockProcessLinkImporter(
            processLinkService,
            repositoryService,
            objectMapper
        )
    }

    @Test
    fun `should be of type 'buildingblockprocesslink'`() {
        assertThat(importer.type()).isEqualTo(BUILDING_BLOCK_PROCESS_LINK)
    }

    @Test
    fun `should depend on building block process definition and extra types`() {
        assertThat(importer.dependsOn())
            .isEqualTo(setOf(BUILDING_BLOCK_PROCESS_DEFINITION, "some-other-type"))
    }

    @Test
    fun `should support valid process link fileName`() {
        assertThat(importer.supports(VALID_FILENAME)).isTrue()
    }

    @Test
    fun `should not support invalid process link fileName`() {
        assertThat(importer.supports("/process-link/not-a-process-link.json")).isFalse()
        assertThat(importer.supports("/process-link/my-process.process-link.json.txt")).isFalse()
        assertThat(importer.supports("/other-path/my-process.process-link.json")).isFalse()
    }

    @Test
    fun `should not be part of case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
    }

    @Test
    fun `should be part of building block definition`() {
        assertThat(importer.partOfBuildingBlockDefinition()).isTrue()
    }

    private companion object {
        const val VALID_FILENAME = "/process-link/my-process.process-link.json"
    }
}