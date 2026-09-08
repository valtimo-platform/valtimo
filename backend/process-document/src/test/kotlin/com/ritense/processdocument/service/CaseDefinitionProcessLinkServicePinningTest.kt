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

package com.ritense.processdocument.service

import com.ritense.processdocument.domain.CaseDefinitionProcessLink
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId.Companion.newId
import com.ritense.processdocument.repository.CaseDefinitionProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * Pinning follows case definition finality and nothing else. Covered here rather than in the integration
 * test because the interesting case - a draft with drafts disabled - needs a different application context.
 */
class CaseDefinitionProcessLinkServicePinningTest {

    private val caseDefinitionProcessLinkRepository = mock<CaseDefinitionProcessLinkRepository>()
    private val repositoryService = mock<OperatonRepositoryService>()
    private val caseDefinitionChecker = mock<CaseDefinitionChecker>()

    private val service = CaseDefinitionProcessLinkService(
        caseDefinitionProcessLinkRepository,
        repositoryService,
        caseDefinitionChecker
    )

    private val caseDefinitionId = CaseDefinitionId("some-case-type", "1.0.0")

    @Test
    fun `should pin an unpinned link of a final case definition to the latest system process version`() {
        whenever(caseDefinitionChecker.isCaseDefinitionFinal(caseDefinitionId)).thenReturn(true)
        whenever(caseDefinitionProcessLinkRepository.findAll()).thenReturn(listOf(unpinnedLink()))
        // The case definition does not own the process, so the second lookup is the one that answers
        stubProcessDefinitionLookups(owned = null, unowned = systemProcessOfVersion(3))

        service.pinLinksThatCanNoLongerChange()

        val saved = argumentCaptor<CaseDefinitionProcessLink>()
        verify(caseDefinitionProcessLinkRepository).save(saved.capture())
        assertThat(saved.firstValue.processDefinitionVersion).isEqualTo(3)
    }

    @Test
    fun `should not pin a draft that cannot be edited because drafts are disabled on this environment`() {
        whenever(caseDefinitionChecker.canUpdateCaseDefinition(caseDefinitionId)).thenReturn(false)
        whenever(caseDefinitionChecker.isCaseDefinitionFinal(caseDefinitionId)).thenReturn(false)
        whenever(caseDefinitionProcessLinkRepository.findAll()).thenReturn(listOf(unpinnedLink()))
        stubProcessDefinitionLookups(owned = null, unowned = systemProcessOfVersion(3))

        service.pinLinksThatCanNoLongerChange()

        verify(caseDefinitionProcessLinkRepository, never()).save(any())
    }

    @Test
    fun `should not pin a link that is already pinned`() {
        whenever(caseDefinitionChecker.isCaseDefinitionFinal(caseDefinitionId)).thenReturn(true)
        whenever(caseDefinitionProcessLinkRepository.findAll()).thenReturn(
            listOf(CaseDefinitionProcessLink(newId(caseDefinitionId, PROCESS_KEY), LINK_TYPE, 1))
        )

        service.pinLinksThatCanNoLongerChange()

        verify(caseDefinitionProcessLinkRepository, never()).save(any())
    }

    /**
     * Both lookups share a method with different specifications, so they are told apart by call order.
     */
    private fun stubProcessDefinitionLookups(
        owned: OperatonProcessDefinition?,
        unowned: OperatonProcessDefinition?
    ) {
        whenever(repositoryService.findProcessDefinition(any())).thenReturn(owned, unowned)
    }

    private fun systemProcessOfVersion(version: Int) = mock<OperatonProcessDefinition> {
        on { this.version } doReturn version
    }

    private fun unpinnedLink() =
        CaseDefinitionProcessLink(newId(caseDefinitionId, PROCESS_KEY), LINK_TYPE, null)

    private companion object {
        const val PROCESS_KEY = "system-process"
        const val LINK_TYPE = "DOCUMENT_UPLOAD"
    }
}
