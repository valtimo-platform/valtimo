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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionDto
import com.ritense.buildingblock.web.rest.dto.UpdateBuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockManagementService(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
    private val authorizationService: AuthorizationService,
) {
    @Transactional(readOnly = true)
    fun getLatestPerKey(): List<BuildingBlockDefinitionDto> {
        denyAuthorization()

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
                name = it.name,
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
        denyAuthorization()

        val entity = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(dto.key, dto.versionTag),
            name = dto.name,
            description = dto.description,
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )
        val saved = buildingBlockDefinitionRepository.saveAndFlush(entity)

        buildingBlockDocumentDefinitionService.ensureEmptyFor(saved.id.key, saved.id.versionTag.toString())

        runWithoutAuthorization {
            buildingBlockDefinitionProcessDefinitionService.createEmptyProcessAndLink(
                saved.name,
                saved.id.key,
                saved.id.versionTag.toString()
            )
        }

        return BuildingBlockDefinitionDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            name = saved.name,
            description = saved.description,
            createdBy = saved.createdBy,
            createdDate = saved.createdDate,
            basedOnVersionTag = saved.basedOnVersionTag?.toString(),
            final = saved.final
        )
    }

    @Transactional
    fun update(key: String, versionTag: String, dto: UpdateBuildingBlockDefinitionDto): BuildingBlockDefinitionDto? {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        val existing = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(id)

        val updated = BuildingBlockDefinition(
            id = existing.id,
            name = dto.name,
            description = dto.description,
            createdBy = existing.createdBy,
            createdDate = existing.createdDate,
            basedOnVersionTag = existing.basedOnVersionTag,
            final = existing.final
        )

        val saved = buildingBlockDefinitionRepository.save(updated)

        return BuildingBlockDefinitionDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            name = saved.name,
            description = saved.description,
            createdBy = saved.createdBy,
            createdDate = saved.createdDate,
            basedOnVersionTag = saved.basedOnVersionTag?.toString(),
            final = saved.final
        )
    }

    @Transactional
    fun finalize(key: String, versionTag: String): BuildingBlockDefinitionDto {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        val existing = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        if (existing.final) {
            return existing.toDto()
        }

        val finalized = buildingBlockDefinitionRepository.save(existing.copy(final = true))
        return finalized.toDto()
    }

    @Transactional(readOnly = true)
    fun getVersionsWithFinalFlag(key: String, pageable: Pageable): Page<BuildingBlockVersionDto> {
        denyAuthorization()

        val page = buildingBlockDefinitionRepository.findAllByIdKey(key, pageable)

        return page.map {
            BuildingBlockVersionDto(
                versionTag = it.id.versionTag.toString(),
                final = it.final
            )
        }
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                BuildingBlockDefinition::class.java,
                Action.deny()
            )
        )
    }
}