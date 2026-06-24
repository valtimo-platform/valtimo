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

import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.BuildingBlockProcessReference

class BuildingBlockProcessLookupImpl(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
) : BuildingBlockProcessLookup {

    override fun findForProcessInstance(processInstanceId: String): BuildingBlockProcessReference? {
        val instance = buildingBlockInstanceRepository.findByProcessInstanceId(processInstanceId)
            ?: return null
        return BuildingBlockProcessReference(
            instanceId = instance.id,
            definitionKey = instance.definition.id.key,
            definitionVersionTag = instance.definition.id.versionTag.toString(),
            documentId = instance.documentId,
        )
    }
}
