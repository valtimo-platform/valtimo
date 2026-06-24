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

package com.ritense.zakenapi.listener

import com.ritense.processdocument.importer.ZaakTypeLinkImporter
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.zakenapi.event.ZaakTypeLinkSavedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.springframework.context.ApplicationEventPublisher

class ZaakTypeLinkConfigurationIssueListenerTest {

    lateinit var applicationEventPublisher: ApplicationEventPublisher
    lateinit var listener: ZaakTypeLinkConfigurationIssueListener

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        applicationEventPublisher = mock()
        listener = ZaakTypeLinkConfigurationIssueListener(applicationEventPublisher)
    }

    @Test
    fun `handleZaakTypeLinkSaved should publish CaseConfigurationIssueResolvedEvent`() {
        listener.handleZaakTypeLinkSaved(ZaakTypeLinkSavedEvent(caseDefinitionId))

        val captor = argumentCaptor<CaseConfigurationIssueResolvedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo(ZaakTypeLinkImporter.ISSUE_TYPE)
    }
}
