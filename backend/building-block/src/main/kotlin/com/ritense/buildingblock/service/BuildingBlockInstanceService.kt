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

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.exception.UnknownBuildingBlockDefinitionException
import com.ritense.buildingblock.exception.UnknownBuildingBlockInstanceException
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class BuildingBlockInstanceService(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val documentService: DocumentService
) {
    @Transactional
    fun create(
        newDocumentRequest: NewDocumentRequest,
        caseDocumentId: UUID,
        activityId: String
    ): BuildingBlockInstance {
        // TODO: add validation building block definition has a main process definition, otherwise it is not valid
        val definitionId = BuildingBlockDefinitionId.of(
            newDocumentRequest.buildingBlockDefinitionKey(),
            newDocumentRequest.buildingBlockDefinitionVersionTag()
        )
        val definition = buildingBlockDefinitionRepository.findByIdOrNull(definitionId)
            ?: throw UnknownBuildingBlockDefinitionException(definitionId)

        val createDocumentResult = documentService.createDocument(newDocumentRequest)

        val document = createDocumentResult
            .resultingDocument()
            .orElseThrow {
                IllegalStateException(
                    "Failed to create document for building block ${definition.id}. Errors: " +
                        createDocumentResult
                            .errors()
                            .joinToString { it.asString() }
                )
            }

        return buildingBlockInstanceRepository.save(
            BuildingBlockInstance(
                documentId = document.id().getId(),
                caseDocumentId = caseDocumentId,
                activityId = activityId,
                definition = definition
            )
        )
    }

    @Transactional(readOnly = true)
    fun get(id: UUID): BuildingBlockInstance? {
        return buildingBlockInstanceRepository.findByIdOrNull(id)
    }

    @Transactional(readOnly = true)
    fun getByDocumentId(documentId: UUID): BuildingBlockInstance? {
        return buildingBlockInstanceRepository.findByDocumentId(documentId)
    }

    @Transactional(readOnly = true)
    fun list(): List<BuildingBlockInstance> {
        return buildingBlockInstanceRepository.findAll()
    }

    @Transactional
    fun delete(id: UUID) {
        val existing = buildingBlockInstanceRepository.findByIdOrNull(id)
            ?: throw UnknownBuildingBlockInstanceException(id)
        buildingBlockInstanceRepository.delete(existing)
    }
}
