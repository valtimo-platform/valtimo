package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import org.operaton.bpm.engine.RepositoryService
import java.io.ByteArrayOutputStream

class BuildingBlockProcessLinkExporter(
    private val processLinkService: ProcessLinkService,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val processLinkMappers: List<ProcessLinkMapper>,
) : Exporter<BuildingBlockProcessDefinitionExportRequest> {

    override fun supports() = BuildingBlockProcessDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockProcessDefinitionExportRequest): ExportResult {
        val processDefinitionId = request.processDefinitionId

        val processDefinitionKey = requireNotNull(
            repositoryService.createProcessDefinitionQuery()
                .processDefinitionId(processDefinitionId)
                .singleResult()
        ).key

        val exportDtos = processLinkService.getProcessLinks(processDefinitionId).map { link ->
            getProcessLinkMapper(link.processLinkType).toProcessLinkExportResponseDto(link)
        }

        val bytes = ByteArrayOutputStream().use {
            objectMapper.writeValue(it, exportDtos)
            it.toByteArray()
        }

        val formattedVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val file = ExportFile(
            PATH.format(
                request.buildingBlockDefinitionId.key,
                formattedVersion,
                processDefinitionKey
            ),
            bytes
        )

        return ExportResult(file)
    }

    private fun getProcessLinkMapper(processLinkType: String): ProcessLinkMapper {
        return processLinkMappers.singleOrNull { it.supportsProcessLinkType(processLinkType) }
            ?: throw IllegalStateException("No ProcessLinkMapper found for processLinkType $processLinkType")
    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/process-link/%s.process-link.json"
    }
}