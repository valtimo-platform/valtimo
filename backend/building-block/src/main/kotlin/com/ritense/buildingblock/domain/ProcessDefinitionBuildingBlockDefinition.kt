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
package com.ritense.buildingblock.domain

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import org.hibernate.annotations.Formula

@Entity
@Table(name = "process_definition_building_block_definition")
class ProcessDefinitionBuildingBlockDefinition(
    @EmbeddedId
    val id: ProcessDefinitionBuildingBlockDefinitionId,
    @Column(name = "main", nullable = false)
    var main: Boolean = false
) {
    @Formula("( " +
        " SELECT   act_re_procdef.name_ " +
        " FROM     act_re_procdef " +
        " WHERE    act_re_procdef.id_ = process_definition_id)")
    var processDefinitionName: String? = null

    @Formula("( " +
        " SELECT   act_re_procdef.key_ " +
        " FROM     act_re_procdef " +
        " WHERE    act_re_procdef.id_ = process_definition_id)")
    var processDefinitionKey: String? = null
}