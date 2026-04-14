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

import com.ritense.processlink.domain.ProcessLinkChangedEvent
import com.ritense.valtimo.processlink.service.PluginConfigurationMappingResolverImpl
import org.assertj.core.api.Assertions.assertThatCode
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.verify

@ExtendWith(MockitoExtension::class)
class ProcessLinkChangedEventListenerTest {

    @Mock
    lateinit var pluginConfigurationMappingResolver: PluginConfigurationMappingResolverImpl

    private lateinit var listener: ProcessLinkChangedEventListener

    @BeforeEach
    fun before() {
        listener = ProcessLinkChangedEventListener(pluginConfigurationMappingResolver)
    }

    @Test
    fun `delegates to resolver with process definition id`() {
        listener.onProcessLinkChanged(ProcessLinkChangedEvent("pd-1"))

        verify(pluginConfigurationMappingResolver).recheckIssuesForProcessDefinition("pd-1")
    }

    @Test
    fun `swallows exceptions from the resolver`() {
        doThrow(RuntimeException("boom"))
            .whenever(pluginConfigurationMappingResolver)
            .recheckIssuesForProcessDefinition("pd-1")

        assertThatCode { listener.onProcessLinkChanged(ProcessLinkChangedEvent("pd-1")) }
            .doesNotThrowAnyException()
    }
}
