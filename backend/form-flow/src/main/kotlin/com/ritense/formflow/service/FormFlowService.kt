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

package com.ritense.formflow.service

import com.ritense.formflow.domain.FormFlowBreadcrumb
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.domain.definition.FormFlowStep
import com.ritense.formflow.domain.definition.configuration.FormFlowStepType
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.domain.instance.FormFlowInstanceId
import com.ritense.formflow.domain.instance.FormFlowStepInstance
import com.ritense.formflow.handler.FormFlowStepTypeHandler
import com.ritense.formflow.handler.TypeProperties
import com.ritense.formflow.repository.FormFlowAdditionalPropertiesSearchRepository
import com.ritense.formflow.repository.FormFlowDefinitionRepository
import com.ritense.formflow.repository.FormFlowInstanceRepository
import com.ritense.logging.withLoggingContext
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional

@Transactional
class FormFlowService(
    private val formFlowDefinitionRepository: FormFlowDefinitionRepository,
    private val formFlowInstanceRepository: FormFlowInstanceRepository,
    private val formFlowAdditionalPropertiesSearchRepository: FormFlowAdditionalPropertiesSearchRepository,
    private val formFlowStepTypeHandlers: List<FormFlowStepTypeHandler>,
    private val caseDefinitionChecker: CaseDefinitionChecker,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
) {

    fun getFormFlowDefinitions(): List<FormFlowDefinition> {
        return formFlowDefinitionRepository.findAll()
    }

    fun getFormFlowDefinitions(caseDefinitionId: CaseDefinitionId): List<FormFlowDefinition> {
        return formFlowDefinitionRepository.findAllByBlueprintId(
            BlueprintType.CASE, caseDefinitionId.key, caseDefinitionId.versionTag
        )
    }

    fun getFormFlowDefinitions(caseDefinitionId: CaseDefinitionId, pageable: Pageable): Page<FormFlowDefinition> {
        return formFlowDefinitionRepository.findAllByBlueprintId(
            BlueprintType.CASE, caseDefinitionId.key, caseDefinitionId.versionTag, pageable
        )
    }

    fun getFormFlowDefinitions(buildingBlockDefinitionId: BuildingBlockDefinitionId): List<FormFlowDefinition> {
        return formFlowDefinitionRepository.findAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK, buildingBlockDefinitionId.key, buildingBlockDefinitionId.versionTag
        )
    }

    fun getFormFlowDefinitions(buildingBlockDefinitionId: BuildingBlockDefinitionId, pageable: Pageable): Page<FormFlowDefinition> {
        return formFlowDefinitionRepository.findAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK, buildingBlockDefinitionId.key, buildingBlockDefinitionId.versionTag, pageable
        )
    }

    fun findDefinition(formFlowId: FormFlowDefinitionId): FormFlowDefinition {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowId.toString()) {
            formFlowDefinitionRepository.getReferenceById(formFlowId)
        }
    }

    fun findDefinition(formFlowDefinitionKey: String, caseDefinitionId: CaseDefinitionId): FormFlowDefinition {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowDefinitionKey) {
            findDefinition(FormFlowDefinitionId.existingId(formFlowDefinitionKey, caseDefinitionId))
        }
    }

    fun findDefinition(formFlowDefinitionKey: String, buildingBlockDefinitionId: BuildingBlockDefinitionId): FormFlowDefinition {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowDefinitionKey) {
            findDefinition(FormFlowDefinitionId.existingId(formFlowDefinitionKey, buildingBlockDefinitionId))
        }
    }

    fun findDefinitionOrNull(formFlowDefinitionKey: String, caseDefinitionId: CaseDefinitionId): FormFlowDefinition? {
        return formFlowDefinitionRepository.findByIdOrNull(FormFlowDefinitionId.existingId(formFlowDefinitionKey, caseDefinitionId))
    }

    fun findDefinitionOrNull(formFlowDefinitionKey: String, buildingBlockDefinitionId: BuildingBlockDefinitionId): FormFlowDefinition? {
        return formFlowDefinitionRepository.findByIdOrNull(FormFlowDefinitionId.existingId(formFlowDefinitionKey, buildingBlockDefinitionId))
    }

    fun findDefinitionByKey(formFlowDefinitionKey: String): FormFlowDefinition? {
        val definitions = formFlowDefinitionRepository.findAllByKey(formFlowDefinitionKey)
        return when {
            definitions.isEmpty() -> null
            definitions.size == 1 -> definitions[0]
            else -> throw IllegalStateException(
                "Multiple form flow definitions found for key '$formFlowDefinitionKey' — specify the blueprint id"
            )
        }
    }

    fun save(formFlowDefinition: FormFlowDefinition): FormFlowDefinition {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowDefinition.id.toString()) {
            val blueprintId = formFlowDefinition.id.blueprintId
            if (blueprintId.isBuildingBlock()) {
                buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(blueprintId.asBuildingBlockDefinitionId()!!)
            } else {
                caseDefinitionChecker.assertCanUpdateCaseDefinition(blueprintId.asCaseDefinitionId()!!)
            }
            formFlowDefinitionRepository.save(formFlowDefinition)
        }
    }

    fun getInstanceById(formFlowInstanceId: FormFlowInstanceId): FormFlowInstance {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowInstanceId.toString()) {
            formFlowInstanceRepository.getReferenceById(formFlowInstanceId)
        }
    }

    fun getByInstanceIdIfExists(formFlowInstanceId: FormFlowInstanceId): FormFlowInstance? {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowInstanceId.toString()) {
            formFlowInstanceRepository.getReferenceById(formFlowInstanceId)
        }
    }

    fun save(formFlowInstance: FormFlowInstance): FormFlowInstance {
        return withLoggingContext(FormFlowDefinition::class.java.canonicalName to formFlowInstance.id.toString()) {
            formFlowInstanceRepository.save(formFlowInstance)
        }
    }

    fun findInstances(additionalProperties: Map<String, Any>): List<FormFlowInstance> {
        return formFlowAdditionalPropertiesSearchRepository.findInstances(additionalProperties)
    }

    fun getFormFlowStepTypeHandler(stepType: FormFlowStepType): FormFlowStepTypeHandler {
        return formFlowStepTypeHandlers.singleOrNull { it.getType() == stepType.name }
            ?: throw IllegalStateException("No formFlowStepTypeHandler found for type '${stepType.name}'")
    }

    fun getTypeProperties(stepInstance: FormFlowStepInstance): TypeProperties {
        return withLoggingContext(FormFlowStepInstance::class.java.canonicalName to stepInstance.id.toString()) {
            getFormFlowStepTypeHandler(stepInstance.definition.type).getTypeProperties(stepInstance)
        }
    }

    fun deleteByKeyAndsCaseDefinition(definitionKey: String, caseDefinitionId: CaseDefinitionId) {
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        formFlowDefinitionRepository.deleteById(FormFlowDefinitionId.existingId(definitionKey, caseDefinitionId))
    }

    fun deleteByKeyAndBuildingBlockDefinition(definitionKey: String, buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        formFlowDefinitionRepository.deleteById(FormFlowDefinitionId.existingId(definitionKey, buildingBlockDefinitionId))
    }

    fun deleteAllByCaseDefinitionId(caseDefinitionId: CaseDefinitionId) {
        caseDefinitionChecker.assertCanUpdateCaseDefinition(caseDefinitionId)
        formFlowDefinitionRepository.deleteAllByBlueprintId(
            BlueprintType.CASE, caseDefinitionId.key, caseDefinitionId.versionTag
        )
    }

    fun deleteAllByBuildingBlockDefinitionId(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        buildingBlockDefinitionChecker.assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId)
        formFlowDefinitionRepository.deleteAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK, buildingBlockDefinitionId.key, buildingBlockDefinitionId.versionTag
        )
    }

    fun getBreadcrumbs(instance: FormFlowInstance): List<FormFlowBreadcrumb> {
        return withLoggingContext(FormFlowInstance::class.java.canonicalName to instance.id.toString()) {
            val lastCompletedOrder = instance.getHistory()
                .filter { it.submissionData != null }
                .maxByOrNull { it.submissionOrder }
                ?.order ?: -1
            val historicBreadcrumbs = instance.getHistory()
                .map { FormFlowBreadcrumb.of(it, it.order <= lastCompletedOrder + 1, it.order <= lastCompletedOrder) }
            val futureBreadcrumbs = getFutureSteps(instance)
                .map { FormFlowBreadcrumb.of(it) }
            historicBreadcrumbs + futureBreadcrumbs
        }
    }

    private fun getFutureSteps(instance: FormFlowInstance): List<FormFlowStep> {
        return withLoggingContext(FormFlowInstance::class.java.canonicalName to instance.id.toString()) {
            getFutureSteps(instance.getHistory().last().definition)
        }
    }

    private fun getFutureSteps(step: FormFlowStep, result: MutableList<FormFlowStep> = mutableListOf()): List<FormFlowStep> {
        return withLoggingContext(FormFlowStep::class.java.canonicalName to step.id.toString()) {
            step.nextSteps.forEach { nextStep ->
                val futureStep = step.id.formFlowDefinition?.steps?.firstOrNull { it.id.key == nextStep.step }
                if (futureStep == null) {
                    return result
                } else if (!result.contains(futureStep)) {
                    result.add(futureStep)
                    return getFutureSteps(futureStep, result)
                }
            }
            result
        }
    }
}
