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
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionMainProcessDefinitionImporterTest(
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val operatonProcessService: OperatonProcessService,
    @Mock private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
) {
    private lateinit var importer: BuildingBlockDefinitionMainProcessDefinitionImporter

    @BeforeEach
    fun before() {
        importer = BuildingBlockDefinitionMainProcessDefinitionImporter(
            objectMapper,
            operatonProcessService,
            buildingBlockDefinitionProcessDefinitionService
        )
    }

    @Test
    fun `should be of type 'form-definition'`() {
        assertThat(importer.type()).isEqualTo("buildingblockmainprocessdefinition")
    }

    @Test
    fun `should depend on building block definition`() {
        assertThat(importer.dependsOn()).isEqualTo(setOf(BUILDING_BLOCK_PROCESS_DEFINITION))
    }

    @Test
    fun `should support document definition fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support invalid document definition fileName`() {
        assertThat(importer.supports("/building-block/not/building-block-definition-main-process-definition.json")).isFalse()
        assertThat(importer.supports("/building-block/building-block-definition-main-process-definition-json")).isFalse()
    }

    private companion object {
        const val FILENAME = "/building-block/building-block-definition-main-process-definition.json"
    }
}