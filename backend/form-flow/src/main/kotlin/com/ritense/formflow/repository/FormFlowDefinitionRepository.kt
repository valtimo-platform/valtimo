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

package com.ritense.formflow.repository

import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.semver4j.Semver
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface FormFlowDefinitionRepository : JpaRepository<FormFlowDefinition, FormFlowDefinitionId> {

    @Query("SELECT f FROM FormFlowDefinition f WHERE f.id.blueprintId.blueprintType = :blueprintType AND f.id.blueprintId.blueprintKey = :blueprintKey AND f.id.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    fun findAllByBlueprintId(blueprintType: BlueprintType, blueprintKey: String, blueprintVersionTag: Semver): List<FormFlowDefinition>

    @Query("SELECT f FROM FormFlowDefinition f WHERE f.id.blueprintId.blueprintType = :blueprintType AND f.id.blueprintId.blueprintKey = :blueprintKey AND f.id.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    fun findAllByBlueprintId(blueprintType: BlueprintType, blueprintKey: String, blueprintVersionTag: Semver, pageable: Pageable): Page<FormFlowDefinition>

    @Query("DELETE FROM FormFlowDefinition f WHERE f.id.blueprintId.blueprintType = :blueprintType AND f.id.blueprintId.blueprintKey = :blueprintKey AND f.id.blueprintId.blueprintVersionTag = :blueprintVersionTag")
    fun deleteAllByBlueprintId(blueprintType: BlueprintType, blueprintKey: String, blueprintVersionTag: Semver)

    @Query("SELECT f FROM FormFlowDefinition f WHERE f.id.key = :key")
    fun findAllByKey(key: String): List<FormFlowDefinition>

}
