package com.ritense.buildingblock.service

import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest

class BuildingBlockDefinitionExporter : Exporter<BuildingBlockDefinitionExportRequest> {
    override fun supports(): Class<BuildingBlockDefinitionExportRequest> {
        TODO("Not yet implemented")
    }

    override fun export(request: BuildingBlockDefinitionExportRequest): ExportResult {
        TODO("Not yet implemented")
    }
}