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

package com.ritense.valtimo.processlink.listener

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.event.ProcessDefinitionDeleted
import com.ritense.valtimo.event.ProcessDefinitionDetached
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class ProcessDefinitionChangedEventListenerTest {

    @Mock
    lateinit var pluginConfigurationMappingResolver: PluginConfigurationMappingResolver

    private lateinit var listener: ProcessDefinitionChangedEventListener

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        listener = ProcessDefinitionChangedEventListener(listOf(pluginConfigurationMappingResolver))
    }

    @Test
    fun `delegates to resolver on process definition deleted`() {
        listener.onProcessDefinitionDeleted(ProcessDefinitionDeleted("pd-1", caseDefinitionId))

        verify(pluginConfigurationMappingResolver).recheckIssuesForCaseDefinition(caseDefinitionId)
    }

    @Test
    fun `delegates to resolver on process definition detached`() {
        listener.onProcessDefinitionDetached(ProcessDefinitionDetached("pd-1", caseDefinitionId))

        verify(pluginConfigurationMappingResolver).recheckIssuesForCaseDefinition(caseDefinitionId)
    }

    @Test
    fun `ignores process definitions without a blueprint`() {
        listener.onProcessDefinitionDeleted(ProcessDefinitionDeleted("pd-1", null))

        verify(pluginConfigurationMappingResolver, never()).recheckIssuesForCaseDefinition(any())
    }

    @Test
    fun `ignores process definitions belonging to a building block`() {
        listener.onProcessDefinitionDeleted(
            ProcessDefinitionDeleted("pd-1", BuildingBlockDefinitionId("my-block", "1.0.0"))
        )

        verify(pluginConfigurationMappingResolver, never()).recheckIssuesForCaseDefinition(any())
    }

    @Test
    fun `swallows exceptions from the resolver`() {
        doThrow(RuntimeException("boom"))
            .whenever(pluginConfigurationMappingResolver)
            .recheckIssuesForCaseDefinition(caseDefinitionId)

        assertThatCode { listener.onProcessDefinitionDeleted(ProcessDefinitionDeleted("pd-1", caseDefinitionId)) }
            .doesNotThrowAnyException()
    }
}
