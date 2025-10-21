package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.impl.BuildingBlockJsonSchemaDocumentDefinitionId
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.document.domain.impl.BuildingBlockJsonSchemaDocumentDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockDocumentDefinitionService(
    private val repository: BuildingBlockJsonSchemaDocumentDefinitionRepository
) {
    @Transactional
    fun ensureEmptyFor(key: String, versionTag: String): BuildingBlockJsonSchemaDocumentDefinition {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, versionTag)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)

        val existing = repository.findById(id)

        if (existing.isPresent) {
            return existing.get()
        }

        val entity = BuildingBlockJsonSchemaDocumentDefinition(id)
        return repository.save(entity)
    }
}