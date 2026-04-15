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

package com.ritense.buildingblock.service

import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.web.rest.dto.FormOption
import com.ritense.logging.withLoggingContext
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Optional
import java.util.UUID

@Service
class BuildingBlockFormDefinitionService(
    private val formDefinitionRepository: FormDefinitionRepository,
    private val definitionChecker: BuildingBlockDefinitionChecker,
) {

    fun getFormOptions(
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): List<FormOption> {
        return formDefinitionRepository.findAllByBlueprintIdOrderByNameAsc(
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        ).map { FormOption(it.id, it.name) }
    }

    fun queryFormDefinitions(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        searchTerm: String?,
        pageable: Pageable
    ): Page<FormIoFormDefinition> {
        return if (searchTerm.isNullOrBlank()) {
            formDefinitionRepository.findAllByBlueprintIdOrderByNameAsc(
                BlueprintType.BUILDING_BLOCK,
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag
            ).let { forms ->
                val start = (pageable.pageNumber * pageable.pageSize).coerceAtMost(forms.size)
                val end = ((pageable.pageNumber + 1) * pageable.pageSize).coerceAtMost(forms.size)
                org.springframework.data.domain.PageImpl(forms.subList(start, end), pageable, forms.size.toLong())
            }
        } else {
            @Suppress("UNCHECKED_CAST")
            formDefinitionRepository.findAllByBlueprintIdAndNameContainingIgnoreCase(
                BlueprintType.BUILDING_BLOCK,
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag,
                searchTerm,
                pageable
            ) as Page<FormIoFormDefinition>
        }
    }

    fun getFormDefinitionById(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        formDefinitionId: UUID
    ): Optional<FormIoFormDefinition> {
        return formDefinitionRepository.findByIdAndBlueprintId(
            formDefinitionId,
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )
    }

    fun getFormDefinitionByName(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        name: String
    ): Optional<FormIoFormDefinition> {
        return formDefinitionRepository.findByNameAndBlueprintId(
            name,
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )
    }

    @Transactional
    fun createFormDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        name: String,
        formDefinition: String,
        isReadOnly: Boolean = false
    ): FormIoFormDefinition {
        return withLoggingContext("formDefinitionName", name) {
            definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

            if (getFormDefinitionByName(buildingBlockDefinitionId, name).isPresent) {
                throw IllegalArgumentException("Duplicate name for new form: $name")
            }

            val blueprintId = FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId)
            val form = FormIoFormDefinition(
                UUID.randomUUID(),
                name,
                formDefinition,
                blueprintId,
                isReadOnly
            )

            logger.info { "Creating form definition '$name' for building block $buildingBlockDefinitionId" }
            formDefinitionRepository.save(form)
        }
    }

    @Transactional
    fun updateFormDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        formDefinitionId: UUID,
        name: String,
        formDefinition: String
    ): FormIoFormDefinition {
        return withLoggingContext("formDefinitionId", formDefinitionId.toString()) {
            definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

            val form = getFormDefinitionById(buildingBlockDefinitionId, formDefinitionId)
                .orElseThrow { IllegalArgumentException("Form definition not found: $formDefinitionId") }

            form.changeName(name)
            form.changeDefinition(formDefinition)

            logger.info { "Updating form definition '$name' for building block $buildingBlockDefinitionId" }
            formDefinitionRepository.save(form)
        }
    }

    @Transactional
    fun copyFormDefinitions(
        sourceBuildingBlockDefinitionId: BuildingBlockDefinitionId,
        targetBuildingBlockDefinitionId: BuildingBlockDefinitionId
    ): Map<UUID, UUID> {
        val mapping = mutableMapOf<UUID, UUID>()
        val targetBlueprintId = FormDefinitionBlueprintId.forBuildingBlock(targetBuildingBlockDefinitionId)
        val sourceForms = formDefinitionRepository.findAllByBlueprintIdOrderByNameAsc(
            BlueprintType.BUILDING_BLOCK,
            sourceBuildingBlockDefinitionId.key,
            sourceBuildingBlockDefinitionId.versionTag
        )
        sourceForms.forEach { oldForm ->
            val newForm = FormIoFormDefinition(
                UUID.randomUUID(),
                oldForm.name,
                oldForm.formDefinition.toString(),
                targetBlueprintId,
                oldForm.isReadOnly
            )
            logger.info {
                "Copying form definition '${oldForm.name}' from building block " +
                    "$sourceBuildingBlockDefinitionId to $targetBuildingBlockDefinitionId"
            }
            formDefinitionRepository.save(newForm)
            mapping[oldForm.id] = newForm.id
        }
        return mapping
    }

    @Transactional
    fun deleteFormDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        formDefinitionId: UUID
    ) {
        withLoggingContext("formDefinitionId", formDefinitionId.toString()) {
            definitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)

            val form = getFormDefinitionById(buildingBlockDefinitionId, formDefinitionId)
                .orElseThrow { IllegalArgumentException("Form definition not found: $formDefinitionId") }

            logger.info { "Deleting form definition '${form.name}' for building block $buildingBlockDefinitionId" }
            formDefinitionRepository.delete(form)
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
