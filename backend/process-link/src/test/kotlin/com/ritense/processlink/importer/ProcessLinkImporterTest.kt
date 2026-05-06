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

package com.ritense.processlink.importer

import com.fasterxml.jackson.annotation.JsonTypeName
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DEFINITION
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class ProcessLinkImporterTest {

    @Mock
    lateinit var processLinkService: ProcessLinkService

    @Mock
    lateinit var repositoryService: OperatonRepositoryService

    @Mock
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var importer: ProcessLinkImporter

    private val objectMapper = MapperSingleton.get().also {
        it.registerSubtypes(TestProcessLinkDeployDto::class.java)
    }

    @BeforeEach
    fun before() {
        importer = ProcessLinkImporter(
            processLinkService,
            repositoryService,
            processDefinitionCaseDefinitionService,
            objectMapper,
            emptyList<ProcessLinkMapper>(),
            applicationEventPublisher,
        )
    }

    @Test
    fun `should be of type 'processlink'`() {
        assertThat(importer.type()).isEqualTo("processlink")
    }

    @Test
    fun `should depend on 'processdefinition' type`() {
        whenever(processLinkService.getImporterDependsOnTypes()).thenReturn(setOf("x", "y", "z"))

        assertThat(importer.dependsOn()).isEqualTo(setOf(PROCESS_DEFINITION, "x", "y", "z"))
    }

    @Test
    fun `should support processlink fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support non-processlink fileName`() {
        assertThat(importer.supports("/process-link/my-process-link.json")).isFalse()
        assertThat(importer.supports("/process-link/test.process-link.xml")).isFalse()
    }

    @Test
    fun `import replaces pluginConfigurationId with mapped value from request`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()

        val capturedDto = importWithMapping(sourceId, mapOf(sourceId to targetId))

        assertThat(capturedDto.pluginConfigurationId).isEqualTo(targetId)
    }

    @Test
    fun `import sets pluginConfigurationId to null when mapping value is null`() {
        val sourceId = UUID.randomUUID()

        val capturedDto = importWithMapping(sourceId, mapOf(sourceId to null))

        assertThat(capturedDto.pluginConfigurationId).isNull()
    }

    @Test
    fun `import leaves pluginConfigurationId untouched when no mapping entry matches`() {
        val sourceId = UUID.randomUUID()
        val otherId = UUID.randomUUID()

        val capturedDto = importWithMapping(sourceId, mapOf(otherId to UUID.randomUUID()))

        assertThat(capturedDto.pluginConfigurationId).isEqualTo(sourceId)
    }

    @Test
    fun `import leaves pluginConfigurationId untouched when mappings are null`() {
        val sourceId = UUID.randomUUID()

        val capturedDto = importWithMapping(sourceId, null)

        assertThat(capturedDto.pluginConfigurationId).isEqualTo(sourceId)
    }

    private fun importWithMapping(
        sourceId: UUID,
        mappings: Map<UUID, UUID?>?,
    ): TestProcessLinkCreateDto {
        val processDefinitionKey = "my"
        val processDefinitionId = "pd-1"
        val mapperMock = TestMapper()

        val operatonPd = mock<OperatonProcessDefinition>()
        whenever(operatonPd.id).thenReturn(processDefinitionId)
        whenever(repositoryService.findLatestProcessDefinition(processDefinitionKey)).thenReturn(operatonPd)
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapperMock)
        doReturn(mock<ProcessLink>()).whenever(processLinkService).createProcessLink(any(), anyOrNull())

        val json = """
            [
              {
                "activityId": "Task_1",
                "activityType": "bpmn:ServiceTask:start",
                "processLinkType": "test-type",
                "pluginConfigurationId": "$sourceId"
              }
            ]
        """.trimIndent()

        importer.import(
            ImportRequest(
                fileName = FILENAME,
                content = json.toByteArray(),
                caseDefinitionId = null,
                pluginConfigurationMappings = mappings,
            )
        )

        return mapperMock.captured!!
    }

    @JsonTypeName("test-type")
    class TestProcessLinkDeployDto(
        override val processDefinitionId: String,
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
        val pluginConfigurationId: UUID? = null,
    ) : ProcessLinkDeployDto {
        override val processLinkType: String = "test-type"
    }

    class TestProcessLinkCreateDto(
        override val processDefinitionId: String,
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
        val pluginConfigurationId: UUID?,
    ) : ProcessLinkCreateRequestDto {
        override val processLinkType: String = "test-type"
    }

    class TestMapper : ProcessLinkMapper {
        var captured: TestProcessLinkCreateDto? = null

        override fun supportsProcessLinkType(processLinkType: String) = processLinkType == "test-type"

        override fun toProcessLinkCreateRequestDto(
            deployDto: ProcessLinkDeployDto,
            blueprintId: BlueprintId?,
        ): ProcessLinkCreateRequestDto {
            deployDto as TestProcessLinkDeployDto
            val dto = TestProcessLinkCreateDto(
                processDefinitionId = deployDto.processDefinitionId,
                activityId = deployDto.activityId,
                activityType = deployDto.activityType,
                pluginConfigurationId = deployDto.pluginConfigurationId,
            )
            captured = dto
            return dto
        }

        override fun toProcessLinkResponseDto(processLink: ProcessLink): ProcessLinkResponseDto {
            throw UnsupportedOperationException()
        }

        override fun toProcessLinkUpdateRequestDto(
            deployDto: ProcessLinkDeployDto,
            existingProcessLinkId: UUID,
            blueprintId: BlueprintId?,
        ): ProcessLinkUpdateRequestDto {
            throw UnsupportedOperationException()
        }

        override fun toProcessLinkExportResponseDto(processLink: ProcessLink): ProcessLinkExportResponseDto {
            throw UnsupportedOperationException()
        }

        override fun toNewProcessLink(
            createRequestDto: ProcessLinkCreateRequestDto,
            blueprintId: BlueprintId?,
        ): ProcessLink {
            throw UnsupportedOperationException()
        }

        override fun toUpdatedProcessLink(
            processLinkToUpdate: ProcessLink,
            updateRequestDto: ProcessLinkUpdateRequestDto,
            blueprintId: BlueprintId?,
        ): ProcessLink {
            throw UnsupportedOperationException()
        }
    }

    private companion object {
        const val FILENAME = "/process-link/my.process-link.json"
    }
}