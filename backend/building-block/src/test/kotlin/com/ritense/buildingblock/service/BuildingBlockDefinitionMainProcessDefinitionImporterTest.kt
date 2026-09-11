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
import com.ritense.buildingblock.domain.BuildingBlockDefinitionMainProcessDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

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

    @Test
    fun `should link the latest deployed version as main process`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId("bezwaar", "1.0.0")
        whenever(objectMapper.readValue(any<String>(), eq(BuildingBlockDefinitionMainProcessDefinitionDto::class.java)))
            .thenReturn(BuildingBlockDefinitionMainProcessDefinitionDto("sub"))
        whenever(operatonProcessService.getDefinitionsByKeyAndBlueprint(buildingBlockDefinitionId, "sub"))
            .thenReturn(listOf(processDefinition("sub:1:aaa", 1), processDefinition("sub:2:bbb", 2)))

        importer.import(
            ImportRequest(FILENAME, "{}".toByteArray(), buildingBlockDefinitionId = buildingBlockDefinitionId)
        )

        verify(buildingBlockDefinitionProcessDefinitionService).setMainLink(
            buildingBlockDefinitionId,
            null,
            ProcessDefinitionId.of("sub:2:bbb"),
            true
        )
    }

    private fun processDefinition(id: String, version: Int) = OperatonProcessDefinition(
        id,
        null,
        null,
        "sub",
        "sub",
        version,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        true
    )

    private companion object {
        const val FILENAME = "/building-block/building-block-definition-main-process-definition.json"
    }
}