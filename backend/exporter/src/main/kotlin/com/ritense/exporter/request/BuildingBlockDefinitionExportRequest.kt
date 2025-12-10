package com.ritense.exporter.request

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

data class BuildingBlockDefinitionExportRequest(
    override val buildingBlockDefinitionId: BuildingBlockDefinitionId
): ExportRequest()