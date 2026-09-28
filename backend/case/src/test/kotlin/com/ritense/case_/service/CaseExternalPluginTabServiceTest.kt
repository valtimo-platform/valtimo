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

package com.ritense.case_.service

import com.ritense.authorization.AuthorizationService
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.domain.tab.CaseExternalPluginTab
import com.ritense.case_.repository.CaseExternalPluginTabRepository
import com.ritense.case_.service.event.CaseTabCreatedEvent
import com.ritense.case_.service.event.CaseTabUpdatedEvent
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class CaseExternalPluginTabServiceTest(
    @Mock private val documentService: DocumentService,
    @Mock private val caseExternalPluginTabRepository: CaseExternalPluginTabRepository,
    @Mock private val caseTabRepository: CaseTabRepository,
    @Mock private val authorizationService: AuthorizationService,
) {
    private lateinit var service: CaseExternalPluginTabService

    @BeforeEach
    fun before() {
        service = CaseExternalPluginTabService(
            documentService,
            caseExternalPluginTabRepository,
            caseTabRepository,
            authorizationService,
            Optional.empty(),
        )
    }

    @Test
    fun `should upsert side row on creation of an EXTERNAL_PLUGIN tab`() {
        val configurationId = UUID.randomUUID()
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, "$configurationId:overview")

        service.handleCaseTabCreatedEvent(CaseTabCreatedEvent(tab))

        val captor = argumentCaptor<CaseExternalPluginTab>()
        verify(caseExternalPluginTabRepository).save(captor.capture())
        assertThat(captor.firstValue.id).isEqualTo(tab.id)
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(configurationId)
        assertThat(captor.firstValue.bundleKey).isEqualTo("overview")
    }

    @Test
    fun `should upsert side row without bundle key when contentKey only contains a configuration id`() {
        val configurationId = UUID.randomUUID()
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, configurationId.toString())

        service.handleCaseTabCreatedEvent(CaseTabCreatedEvent(tab))

        val captor = argumentCaptor<CaseExternalPluginTab>()
        verify(caseExternalPluginTabRepository).save(captor.capture())
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(configurationId)
        assertThat(captor.firstValue.bundleKey).isNull()
    }

    @Test
    fun `should not create a side row for a non-EXTERNAL_PLUGIN tab`() {
        val tab = caseTab(CaseTabType.WIDGETS, "my-widgets-tab")

        service.handleCaseTabCreatedEvent(CaseTabCreatedEvent(tab))

        verify(caseExternalPluginTabRepository, never()).save(any())
    }

    @Test
    fun `should skip side row creation for a malformed contentKey instead of throwing`() {
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, "not-a-uuid:overview")

        assertDoesNotThrow {
            service.handleCaseTabCreatedEvent(CaseTabCreatedEvent(tab))
        }

        verify(caseExternalPluginTabRepository, never()).save(any())
    }

    @Test
    fun `should re-point the side row on update of an EXTERNAL_PLUGIN tab`() {
        val configurationId = UUID.randomUUID()
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, configurationId.toString())

        service.handleCaseTabUpdatedEvent(CaseTabUpdatedEvent(tab))

        val captor = argumentCaptor<CaseExternalPluginTab>()
        verify(caseExternalPluginTabRepository).save(captor.capture())
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(configurationId)
    }

    @Test
    fun `should skip side row update for a malformed contentKey instead of throwing`() {
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, "not-a-uuid")

        assertDoesNotThrow {
            service.handleCaseTabUpdatedEvent(CaseTabUpdatedEvent(tab))
        }

        verify(caseExternalPluginTabRepository, never()).save(any())
    }

    @Test
    fun `should delete stale side row when a tab is updated to a non-EXTERNAL_PLUGIN type`() {
        val tab = caseTab(CaseTabType.WIDGETS, "my-widgets-tab")
        val staleSideRow = CaseExternalPluginTab(tab.id, UUID.randomUUID())
        whenever(caseExternalPluginTabRepository.findById(tab.id)).thenReturn(Optional.of(staleSideRow))

        service.handleCaseTabUpdatedEvent(CaseTabUpdatedEvent(tab))

        verify(caseExternalPluginTabRepository).delete(staleSideRow)
        verify(caseExternalPluginTabRepository, never()).save(any())
    }

    @Test
    fun `should not delete anything when a non-EXTERNAL_PLUGIN tab has no side row`() {
        val tab = caseTab(CaseTabType.STANDARD, "my-standard-tab")
        whenever(caseExternalPluginTabRepository.findById(tab.id)).thenReturn(Optional.empty())

        service.handleCaseTabUpdatedEvent(CaseTabUpdatedEvent(tab))

        verify(caseExternalPluginTabRepository, never()).delete(any())
    }

    @Test
    fun `should list usages for a configuration including the tab name`() {
        val configurationId = UUID.randomUUID()
        val tab = caseTab(CaseTabType.EXTERNAL_PLUGIN, configurationId.toString())
        val sideRow = CaseExternalPluginTab(tab.id, configurationId)
        whenever(caseExternalPluginTabRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(listOf(sideRow))
        whenever(caseTabRepository.findById(tab.id)).thenReturn(Optional.of(tab))

        val usages = service.findUsagesForConfiguration(configurationId)

        assertThat(usages).containsExactly(
            CaseExternalPluginTabUsage(
                configurationId = configurationId,
                caseDefinitionKey = CASE_DEFINITION_ID.key,
                caseDefinitionVersionTag = CASE_DEFINITION_ID.versionTag.toString(),
                tabKey = tab.id.key,
                tabName = tab.name,
            )
        )
    }

    @Test
    fun `should list usages with a null tab name when the parent tab is missing`() {
        val configurationId = UUID.randomUUID()
        val tabId = CaseTabId(CASE_DEFINITION_ID, "orphaned")
        val sideRow = CaseExternalPluginTab(tabId, configurationId)
        whenever(caseExternalPluginTabRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(listOf(sideRow))
        whenever(caseTabRepository.findById(tabId)).thenReturn(Optional.empty())

        val usages = service.findUsagesForConfiguration(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.single().tabName).isNull()
    }

    @Test
    fun `should return empty usages when no side rows reference the configuration`() {
        val configurationId = UUID.randomUUID()
        whenever(caseExternalPluginTabRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(emptyList())

        assertThat(service.findUsagesForConfiguration(configurationId)).isEmpty()
    }

    private fun caseTab(type: CaseTabType, contentKey: String) = CaseTab(
        id = CaseTabId(CASE_DEFINITION_ID, "my-tab"),
        name = "My tab",
        tabOrder = 0,
        type = type,
        contentKey = contentKey,
    )

    private companion object {
        val CASE_DEFINITION_ID: CaseDefinitionId = CaseDefinitionId.of("my-case-definition", "1.0.0")
    }
}
