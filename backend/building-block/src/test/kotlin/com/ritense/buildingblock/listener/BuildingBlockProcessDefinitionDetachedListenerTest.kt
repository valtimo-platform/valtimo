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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.event.ProcessDefinitionDetached
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever

class BuildingBlockProcessDefinitionDetachedListenerTest {

    private val repository: ProcessDefinitionBuildingBlockDefinitionRepository = mock()
    private val listener = BuildingBlockProcessDefinitionDetachedListener(repository)

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bezwaar", "1.0.0")
    private val processDefinitionId = ProcessDefinitionId.of("sub:1:aaa")

    @Test
    fun `should delete the link of a detached building block process`() {
        val link = ProcessDefinitionBuildingBlockDefinition(
            ProcessDefinitionBuildingBlockDefinitionId(processDefinitionId, buildingBlockDefinitionId),
            true
        )
        whenever(
            repository.findByIdBuildingBlockDefinitionIdAndIdProcessDefinitionId(
                buildingBlockDefinitionId,
                processDefinitionId
            )
        ).thenReturn(link)

        listener.handleProcessDefinitionDetached(
            ProcessDefinitionDetached(processDefinitionId.id, buildingBlockDefinitionId)
        )

        verify(repository).delete(link)
    }

    @Test
    fun `should do nothing when the detached process has no link`() {
        listener.handleProcessDefinitionDetached(
            ProcessDefinitionDetached(processDefinitionId.id, buildingBlockDefinitionId)
        )

        verify(repository, never()).delete(any())
    }

    @Test
    fun `should ignore a detached case definition process`() {
        listener.handleProcessDefinitionDetached(
            ProcessDefinitionDetached(processDefinitionId.id, CaseDefinitionId.of("bezwaar", "1.0.0"))
        )

        verifyNoInteractions(repository)
    }
}
