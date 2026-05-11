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
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionArtworkDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.media.ImageNormalizer
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockDefinitionArtworkService(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository,
    private val authorizationService: AuthorizationService,
) {

    @Transactional(readOnly = true)
    fun getArtwork(key: String, versionTag: String): BuildingBlockDefinitionArtworkDto? {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        val artwork = buildingBlockDefinitionArtworkRepository.findByIdOrNull(id) ?: return null

        return BuildingBlockDefinitionArtworkDto(
            key = artwork.id.key,
            versionTag = artwork.id.versionTag.toString(),
            imageBase64 = artwork.imageBase64
        )
    }

    @Transactional
    fun createArtwork(
        key: String,
        versionTag: String,
        dto: CreateBuildingBlockDefinitionArtworkDto
    ): BuildingBlockDefinitionArtworkDto {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)

        val definition = buildingBlockDefinitionRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockDefinitionException(id)

        if (buildingBlockDefinitionArtworkRepository.existsById(id)) {
            throw IllegalStateException("Artwork already exists for building block definition $key:$versionTag")
        }

        val normalizedBase64 = ImageNormalizer.normalizeAndValidateImage(dto.imageBase64)

        val entity = BuildingBlockDefinitionArtwork(
            definition = definition,
            imageBase64 = normalizedBase64,
            id = id
        )

        val saved = buildingBlockDefinitionArtworkRepository.save(entity)

        return BuildingBlockDefinitionArtworkDto(
            key = saved.id.key,
            versionTag = saved.id.versionTag.toString(),
            imageBase64 = saved.imageBase64
        )
    }

    @Transactional
    fun deleteArtwork(key: String, versionTag: String) {
        denyAuthorization()

        val id = BuildingBlockDefinitionId(key, versionTag)
        if (buildingBlockDefinitionArtworkRepository.existsById(id)) {
            buildingBlockDefinitionArtworkRepository.deleteById(id)
        }
    }

    private fun denyAuthorization() {
        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                BuildingBlockDefinitionArtwork::class.java,
                Action.deny()
            )
        )
    }

}