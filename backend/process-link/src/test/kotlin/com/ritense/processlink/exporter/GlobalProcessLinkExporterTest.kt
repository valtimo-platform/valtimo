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

package com.ritense.processlink.exporter

import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.manifest.DependencyType
import com.ritense.exporter.manifest.ResolvableValue
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
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
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.data.jpa.domain.Specification

@ExtendWith(MockitoExtension::class)
class GlobalProcessLinkExporterTest {

    @Mock
    lateinit var processLinkService: ProcessLinkService

    @Mock
    lateinit var repositoryService: OperatonRepositoryService

    private lateinit var exporter: GlobalProcessLinkExporter

    @BeforeEach
    fun before() {
        exporter = GlobalProcessLinkExporter(
            MapperSingleton.get(),
            processLinkService,
            repositoryService,
        )
    }

    @Test
    fun `should export process links into the global folder structure`() {
        val processLink = mock<ProcessLink>()
        val mapper = mapperReturning()
        whenever(processLink.processLinkType).thenReturn("test-type")
        whenever(processLinkService.getProcessLinks(PROCESS_DEFINITION_ID)).thenReturn(listOf(processLink))
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)
        mockProcessDefinition()

        val result = exporter.export(GlobalProcessDefinitionExportRequest(PROCESS_DEFINITION_ID))

        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("config/global/process-link/my-process.process-link.json")
        assertThat(exportFile.content.toString(Charsets.UTF_8))
            .contains("\"activityId\" : \"Task_1\"")
            .contains("\"processLinkType\" : \"test-type\"")
    }

    @Test
    fun `should not create related export requests for referenced definitions`() {
        val processLink = mock<ProcessLink>()
        val mapper = mapperReturning()
        whenever(processLink.processLinkType).thenReturn("test-type")
        whenever(processLinkService.getProcessLinks(PROCESS_DEFINITION_ID)).thenReturn(listOf(processLink))
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)
        mockProcessDefinition()

        val result = exporter.export(GlobalProcessDefinitionExportRequest(PROCESS_DEFINITION_ID))

        assertThat(result.relatedRequests).isEmpty()
    }

    /**
     * The importer only removes process links of a process it receives a file for, so a process
     * without process links has to export an empty file instead of no file at all.
     */
    @Test
    fun `should export an empty process link file when the process has no process links`() {
        whenever(processLinkService.getProcessLinks(PROCESS_DEFINITION_ID)).thenReturn(emptyList())
        mockProcessDefinition()

        val result = exporter.export(GlobalProcessDefinitionExportRequest(PROCESS_DEFINITION_ID))

        val exportFile = result.exportFiles.single()
        assertThat(exportFile.path).isEqualTo("config/global/process-link/my-process.process-link.json")
        assertThat(exportFile.content.toString(Charsets.UTF_8)).isEqualTo("[]")
        assertThat(result.relatedRequests).isEmpty()
    }

    /**
     * The manifest of the export tells what the target environment needs, which for a process link is
     * the plugin it uses.
     */
    @Test
    fun `should contribute the manifest dependencies of the process links`() {
        val processLink = mock<ProcessLink>()
        val mapper = mapperReturning()
        val dependency = ArtifactDependency(
            type = DependencyType.PLUGIN,
            key = ResolvableValue.of("documentenapi"),
            title = ResolvableValue.of("Documenten API"),
        )
        whenever(mapper.toManifestDependencies(processLink)).thenReturn(setOf(dependency))
        whenever(processLink.processLinkType).thenReturn("test-type")
        whenever(processLinkService.getProcessLinks(PROCESS_DEFINITION_ID)).thenReturn(listOf(processLink))
        whenever(processLinkService.getProcessLinkMapper("test-type")).thenReturn(mapper)
        mockProcessDefinition()

        val result = exporter.export(GlobalProcessDefinitionExportRequest(PROCESS_DEFINITION_ID))

        assertThat(result.manifestDependencies).containsExactly(dependency)
        // The process definition of the request is the artifact of the export
        assertThat(result.manifestArtifact).isNull()
    }

    @Test
    fun `should support the global process definition export request`() {
        assertThat(exporter.supports()).isEqualTo(GlobalProcessDefinitionExportRequest::class.java)
    }

    private fun mockProcessDefinition() {
        val processDefinition = mock<OperatonProcessDefinition>()
        whenever(processDefinition.key).thenReturn("my-process")
        whenever(repositoryService.findProcessDefinition(any<Specification<OperatonProcessDefinition>>()))
            .thenReturn(processDefinition)
    }

    private fun mapperReturning(): ProcessLinkMapper {
        val mapper = mock<ProcessLinkMapper>()
        whenever(mapper.toProcessLinkExportResponseDto(any())).thenReturn(
            TestProcessLinkExportResponseDto("Task_1", ActivityTypeWithEventName.SERVICE_TASK_START)
        )
        return mapper
    }

    private class TestProcessLinkExportResponseDto(
        override val activityId: String,
        override val activityType: ActivityTypeWithEventName,
    ) : ProcessLinkExportResponseDto {
        override val processLinkType: String = "test-type"
    }

    private companion object {
        const val PROCESS_DEFINITION_ID = "pd-1"
    }
}
