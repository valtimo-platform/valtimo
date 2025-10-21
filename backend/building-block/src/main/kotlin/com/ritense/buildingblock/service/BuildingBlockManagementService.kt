package com.ritense.buildingblock.service

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockManagementService(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
    private val buildingBlockProcessService: BuildingBlockProcessService
) {
    @Transactional(readOnly = true)
    fun getLatestPerKey(): List<BuildingBlockDefinitionDto> {
        val all = buildingBlockDefinitionRepository.findAll()
        val latestPerKey = all
            .groupBy { it.id.key }
            .values
            .mapNotNull { defsForKey ->
                defsForKey.maxWithOrNull { a, b ->
                    val va = Semver(a.id.versionTag.toString())
                    val vb = Semver(b.id.versionTag.toString())
                    va.compareTo(vb)
                }
            }
        return latestPerKey.map {
            BuildingBlockDefinitionDto(
                key = it.id.key,
                versionTag = it.id.versionTag.toString(),
                title = it.title,
                description = it.description,
                createdBy = it.createdBy,
                createdDate = it.createdDate,
                basedOnVersionTag = it.basedOnVersionTag?.toString(),
                final = it.final
            )
        }
    }

    @Transactional
    fun create(dto: CreateBuildingBlockDefinitionDto): BuildingBlockDefinitionDto {
        val entity = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(dto.key, dto.versionTag),
            title = dto.title,
            description = dto.description,
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )
        val saved = buildingBlockDefinitionRepository.saveAndFlush(entity)

        buildingBlockDocumentDefinitionService.ensureEmptyFor(saved.id.key, saved.id.versionTag.toString())
        buildingBlockProcessService.createEmptyProcessAndLink(saved.title, saved.id.key, saved.id.versionTag.toString())

        return BuildingBlockDefinitionDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            title = saved.title,
            description = saved.description,
            createdBy = saved.createdBy,
            createdDate = saved.createdDate,
            basedOnVersionTag = saved.basedOnVersionTag?.toString(),
            final = saved.final
        )
    }
}