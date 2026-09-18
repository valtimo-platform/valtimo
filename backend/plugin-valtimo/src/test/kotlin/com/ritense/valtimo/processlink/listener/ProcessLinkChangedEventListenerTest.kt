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

import com.ritense.processlink.event.ProcessLinkCreatedEvent
import com.ritense.processlink.event.ProcessLinkDeletedEvent
import com.ritense.processlink.event.ProcessLinkUpdatedEvent
import com.ritense.processlink.event.ProcessLinksDeployedEvent
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class ProcessLinkChangedEventListenerTest {

    @Mock
    lateinit var pluginConfigurationMappingResolver: PluginConfigurationMappingResolver

    private lateinit var listener: ProcessLinkChangedEventListener

    @BeforeEach
    fun before() {
        listener = ProcessLinkChangedEventListener(listOf(pluginConfigurationMappingResolver))
    }

    @Test
    fun `delegates to resolver on process link created`() {
        listener.onProcessLinkCreated(ProcessLinkCreatedEvent("plugin", "pd-1"))

        verify(pluginConfigurationMappingResolver).recheckIssuesForProcessDefinition("pd-1")
    }

    @Test
    fun `delegates to resolver on process link updated`() {
        listener.onProcessLinkUpdated(ProcessLinkUpdatedEvent("plugin", "pd-1"))

        verify(pluginConfigurationMappingResolver).recheckIssuesForProcessDefinition("pd-1")
    }

    @Test
    fun `delegates to resolver on process link deleted`() {
        listener.onProcessLinkDeleted(ProcessLinkDeletedEvent("plugin", "pd-1"))

        verify(pluginConfigurationMappingResolver).recheckIssuesForProcessDefinition("pd-1")
    }

    @Test
    fun `rechecks the case definition on process links deployed`() {
        val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

        listener.onProcessLinksDeployed(ProcessLinksDeployedEvent("pd-1", caseDefinitionId))

        verify(pluginConfigurationMappingResolver).recheckIssuesForCaseDefinition(caseDefinitionId)
    }

    @Test
    fun `ignores process links deployed without a case definition blueprint`() {
        listener.onProcessLinksDeployed(ProcessLinksDeployedEvent("pd-1", null))

        verify(pluginConfigurationMappingResolver, never()).recheckIssuesForCaseDefinition(any())
    }

    @Test
    fun `swallows exceptions from the resolver`() {
        doThrow(RuntimeException("boom"))
            .whenever(pluginConfigurationMappingResolver)
            .recheckIssuesForProcessDefinition("pd-1")

        assertThatCode { listener.onProcessLinkCreated(ProcessLinkCreatedEvent("plugin", "pd-1")) }
            .doesNotThrowAnyException()
    }

    @Test
    fun `delegates to every registered resolver, one throwing does not block the others`() {
        val secondResolver: PluginConfigurationMappingResolver = mock()
        doThrow(RuntimeException("boom"))
            .whenever(pluginConfigurationMappingResolver)
            .recheckIssuesForProcessDefinition("pd-1")
        val multiResolverListener =
            ProcessLinkChangedEventListener(listOf(pluginConfigurationMappingResolver, secondResolver))

        assertThatCode { multiResolverListener.onProcessLinkCreated(ProcessLinkCreatedEvent("plugin", "pd-1")) }
            .doesNotThrowAnyException()

        verify(pluginConfigurationMappingResolver).recheckIssuesForProcessDefinition("pd-1")
        verify(secondResolver).recheckIssuesForProcessDefinition("pd-1")
    }
}
